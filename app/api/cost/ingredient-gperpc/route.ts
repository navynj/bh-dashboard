import { NextRequest, NextResponse } from 'next/server';
import { createAdminApiClient } from '@shopify/admin-api-client';
import { auth, getCanSeeDeliveryAndCost, requireActiveSession } from '@/lib/auth';
import { prisma } from '@/lib/core/prisma';
import { toApiErrorResponse } from '@/lib/core/errors';

const VARIANT_METAFIELD_QUERY = `
  query GetVariantMetafield($id: ID!) {
    productVariant(id: $id) {
      product {
        metafield(namespace: "custom", key: "ingredient_information") {
          id
          jsonValue
        }
      }
    }
  }
`;

const METAOBJECT_QUERY = `
  query GetMetaobject($id: ID!) {
    metaobject(id: $id) {
      id
      fields { key value type }
    }
  }
`;

const METAOBJECT_UPDATE = `
  mutation MetaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject {
        id
        fields { key value }
      }
      userErrors { field message }
    }
  }
`;

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!requireActiveSession(session) || !getCanSeeDeliveryAndCost(session?.user?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { variantId, gPerPc } = await req.json() as { variantId: string; gPerPc: number };

    if (!variantId) return NextResponse.json({ error: 'variantId required' }, { status: 400 });
    if (typeof gPerPc !== 'number' || gPerPc <= 0) {
      return NextResponse.json({ error: 'gPerPc must be a positive number' }, { status: 400 });
    }

    const shopifyConfig = await prisma.shopifyConfig.findFirst();
    if (!shopifyConfig) return NextResponse.json({ error: 'Shopify not configured' }, { status: 503 });

    const gid = variantId.startsWith('gid://') ? variantId : `gid://shopify/ProductVariant/${variantId}`;

    const client = createAdminApiClient({
      storeDomain: shopifyConfig.shopifyUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      apiVersion: shopifyConfig.apiVersion,
      accessToken: shopifyConfig.adminToken,
    });

    // 1. Get metafield reference from variant's product
    const variantRes = await client.request<{
      productVariant?: {
        product?: {
          metafield?: { id: string; jsonValue?: string[] };
        };
      };
    }>(VARIANT_METAFIELD_QUERY, { variables: { id: gid } });

    const metafieldId = variantRes.data?.productVariant?.product?.metafield?.jsonValue?.[0];
    if (!metafieldId) {
      return NextResponse.json(
        { error: 'Product metafield not found. Configure the product in Shopify first.' },
        { status: 404 },
      );
    }

    // 2. Fetch metaobject fields
    const metaRes = await client.request<{
      metaobject?: { id: string; fields: { key: string; value: string; type: string }[] };
    }>(METAOBJECT_QUERY, { variables: { id: metafieldId } });

    const metaobject = metaRes.data?.metaobject;
    if (!metaobject) return NextResponse.json({ error: 'Metaobject not found' }, { status: 404 });

    // 3. Build updated fields (keep existing, update/add g_per_pc)
    const fields = metaobject.fields
      .filter((f) => f.value != null && f.value !== '')
      .map((f) => ({
        key: f.key,
        value: f.key === 'g_per_pc' ? gPerPc.toString() : f.value,
      }));

    if (!fields.some((f) => f.key === 'g_per_pc')) {
      fields.push({ key: 'g_per_pc', value: gPerPc.toString() });
    }

    // 4. Persist to Shopify
    const updateRes = await client.request<{
      metaobjectUpdate?: {
        metaobject?: { id: string };
        userErrors?: { field: string; message: string }[];
      };
    }>(METAOBJECT_UPDATE, { variables: { id: metafieldId, metaobject: { fields } } });

    const userErrors = updateRes.data?.metaobjectUpdate?.userErrors ?? [];
    if (userErrors.length > 0) {
      return NextResponse.json({ error: userErrors[0]?.message ?? 'Update failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, gPerPc });
  } catch (err) {
    return toApiErrorResponse(err, 'PATCH /api/cost/ingredient-gperpc error:');
  }
}
