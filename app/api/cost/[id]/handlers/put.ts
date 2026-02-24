import type { EnhanceableItem } from '../utils/itemEnhancement';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { logCostHistory } from '../utils/historyLogging';
import { processItemsWithShopifyData } from '../utils/itemEnhancement';
import { compareItems } from '../utils/changeDetection';
import {
  processIngredientsBatch,
  processPackagingsBatch,
  processLaborsBatch,
  processOthersBatch,
} from '../utils/batchOperations';
import { processPrices } from '../utils/priceProcessing';
import {
  updateCostTags,
  fetchCostTagsWithDetails,
} from '../utils/tagOperations';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return new Response('Session not found', { status: 401 });
    }

    const { id } = await params;
    const {
      ingredients: ingredientsPayload,
      prices: pricesPayload,
      packagings: packagingsPayload,
      labors: laborsPayload,
      others: othersPayload,
      tags: tagsPayload,
      ...costPayload
    } = await req.json();

    const costBeforeUpdate = await prisma.cost.findUnique({
      where: { id },
      include: {
        ingredients: true,
        packagings: true,
        labors: true,
        others: true,
        prices: true,
      },
    });

    const changes: Record<string, unknown> = {};
    if (costBeforeUpdate) {
      if (
        costPayload.title !== undefined &&
        costPayload.title !== costBeforeUpdate.title
      ) {
        changes.title = { from: costBeforeUpdate.title, to: costPayload.title };
      }
      if (
        costPayload.totalCount !== undefined &&
        costPayload.totalCount !== costBeforeUpdate.totalCount
      ) {
        changes.totalCount = {
          from: costBeforeUpdate.totalCount,
          to: costPayload.totalCount,
        };
      }
      if (
        costPayload.lossAmount !== undefined &&
        costPayload.lossAmount !== costBeforeUpdate.lossAmount
      ) {
        changes.lossAmount = {
          from: costBeforeUpdate.lossAmount,
          to: costPayload.lossAmount,
        };
      }
      if (
        costPayload.finalWeight !== undefined &&
        costPayload.finalWeight !== costBeforeUpdate.finalWeight
      ) {
        changes.finalWeight = {
          from: costBeforeUpdate.finalWeight,
          to: costPayload.finalWeight,
        };
      }
      if (
        costPayload.locked !== undefined &&
        costPayload.locked !== costBeforeUpdate.locked
      ) {
        changes.locked = {
          from: costBeforeUpdate.locked,
          to: costPayload.locked,
        };
      }

      const ingredientChanges = compareItems(
        costBeforeUpdate.ingredients,
        ingredientsPayload,
        'ingredient'
      );
      const packagingChanges = compareItems(
        costBeforeUpdate.packagings,
        packagingsPayload,
        'packaging'
      );
      const laborChanges = compareItems(
        costBeforeUpdate.labors,
        laborsPayload,
        'labor'
      );
      const otherChanges = compareItems(
        costBeforeUpdate.others,
        othersPayload,
        'other'
      );
      const priceChanges = compareItems(
        costBeforeUpdate.prices,
        pricesPayload,
        'price'
      );

      if (ingredientChanges.length > 0) changes.ingredients = ingredientChanges;
      if (packagingChanges.length > 0) changes.packaging = packagingChanges;
      if (laborChanges.length > 0) changes.labor = laborChanges;
      if (otherChanges.length > 0) changes.other = otherChanges;
      if (priceChanges.length > 0) changes.price = priceChanges;
    }

    const cost = await prisma.cost.update({
      where: { id },
      data: {
        title: costPayload.title,
        totalCount: costPayload.totalCount,
        lossAmount: costPayload.lossAmount,
        finalWeight: costPayload.finalWeight,
        locked: costPayload.locked,
      },
      include: {
        ingredients: true,
        packagings: true,
        labors: true,
        others: true,
        prices: true,
      },
    });

    const costId = cost.id;

    const [ingredients, packagings, labors, others, finalPrices] =
      await Promise.all([
        processIngredientsBatch(cost.ingredients, ingredientsPayload, costId),
        processPackagingsBatch(cost.packagings, packagingsPayload, costId),
        processLaborsBatch(cost.labors, laborsPayload, costId),
        processOthersBatch(cost.others, othersPayload, costId),
        processPrices(cost.prices, pricesPayload, costId),
      ]);

    const shopifyConfig = await prisma.shopifyConfig.findFirst();
    const configForEnhance = shopifyConfig
      ? {
          id: shopifyConfig.id,
          shopifyUrl: shopifyConfig.shopifyUrl,
          adminToken: shopifyConfig.adminToken,
          apiVersion: shopifyConfig.apiVersion,
          query: shopifyConfig.query,
        }
      : null;

    const [enhancedIngredients, enhancedPackagings] = await Promise.all([
      processItemsWithShopifyData(
        ingredients as unknown as EnhanceableItem[],
        configForEnhance,
        'ingredient'
      ),
      processItemsWithShopifyData(
        packagings as unknown as EnhanceableItem[],
        configForEnhance,
        'packaging'
      ),
    ]);

    if (tagsPayload !== undefined && Array.isArray(tagsPayload)) {
      await updateCostTags(id, tagsPayload);
    }

    const costTags = await fetchCostTagsWithDetails(id);

    if (Object.keys(changes).length > 0 && session.user.id) {
      await logCostHistory(id, session.user.id, 'updated', changes);
    }

    return NextResponse.json(
      {
        ...cost,
        ingredients: enhancedIngredients,
        packagings: enhancedPackagings,
        labors,
        others,
        prices: finalPrices,
        tags: costTags.map((ct) => ct.Tag),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: (error as Error)?.message || 'Error occurred' },
      { status: 500 }
    );
  }
}
