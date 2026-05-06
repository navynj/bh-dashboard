import type {
  CostEditorState,
  CostSavePayload,
  IngredientEditorItem,
  LaborEditorItem,
  OtherEditorItem,
  PriceEditorItem,
  CostDetailApiResponse,
} from '../types/cost';

export function buildSavePayload(state: CostEditorState): CostSavePayload {
  return {
    title: state.title,
    totalCount: state.totalCount,
    lossAmount: state.lossAmount,
    finalWeight: state.finalWeight,
    locked: state.locked,
    tagIds: state.tags.map((t) => t.id),
    ingredients: state.ingredients.map(serializeIngredient),
    packagings: state.packagings.map(serializeIngredient),
    labors: state.labors.map(serializeLabor),
    others: state.others.map(serializeOther),
    prices: state.prices.map(serializePrice),
  };
}

function serializeIngredient(i: IngredientEditorItem) {
  return {
    id: i.id,
    title: i.title,
    unit: i.unit,
    amount: i.amount,
    variantId: i.variantId,
    type: i.type,
    image: i.image,
    rank: i.rank,
  };
}

function serializeLabor(l: LaborEditorItem) {
  return { id: l.id, title: l.title, time: l.time, people: l.people, wage: l.wage, rank: l.rank };
}

function serializeOther(o: OtherEditorItem) {
  return { id: o.id, title: o.title, amount: o.amount, rank: o.rank };
}

function serializePrice(p: PriceEditorItem) {
  return { id: p.id, title: p.title, margin: p.margin, price: p.price, base: p.base, isFinalPrice: p.isFinalPrice, rank: p.rank };
}

export function deserializeCost(api: CostDetailApiResponse): CostEditorState {
  return {
    id: api.id,
    title: api.title,
    totalCount: api.totalCount,
    lossAmount: api.lossAmount,
    finalWeight: api.finalWeight,
    locked: api.locked,
    tags: api.tags,
    ingredients: api.ingredients.map((i) => ({ ...i, isNew: false })),
    packagings: api.packagings.map((p) => ({ ...p, isNew: false })),
    labors: api.labors.map((l) => ({ ...l, isNew: false })),
    others: api.others.map((o) => ({ ...o, isNew: false })),
    prices: api.prices,
  };
}

export function defaultCostState(): CostEditorState {
  return {
    id: undefined,
    title: '',
    totalCount: 1,
    lossAmount: null,
    finalWeight: null,
    locked: false,
    ingredients: [],
    packagings: [],
    labors: [],
    others: [],
    prices: [],
    tags: [],
  };
}
