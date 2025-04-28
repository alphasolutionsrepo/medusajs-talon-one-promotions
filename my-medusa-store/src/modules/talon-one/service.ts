import {
  CartDTO,
  ComputeActions,
  ConfigModule,
  LineItemAdjustmentDTO,
  Logger,
  PromotionTypes,
  ShippingMethodAdjustmentDTO,
} from "@medusajs/framework/types";
import { ComputedActions, isDefined, isString } from "@medusajs/framework/utils";
import { ApiClient, IntegrationApi, IntegrationStateV2 } from "talon_one";

const defaultClient = ApiClient.instance;
defaultClient.basePath = process.env.TALON_ONE_BASE_PATH!;
const auth = defaultClient.authentications["api_key_v1"];
auth.apiKey = process.env.TALON_ONE_API_KEY!;
auth.apiKeyPrefix = process.env.TALON_ONE_API_KEY_PREFIX!;

const integrationApi = new IntegrationApi();

type TalonEffect = {
  campaignId: number;
  rulesetId: number;
  effectType: "acceptCoupon" | "setDiscountPerItem" | string;
  props: {
    value?: number | string;
    position?: number;
  };
};

export type ModuleOptions = {
  basePath: string;
  apiKey: string;
  apiKeyPrefix: string;
};

export type InjectedDependencies = {
  logger: Logger;
  configModule: ConfigModule;
};

class TalonOneModuleService {
  private options: ModuleOptions;
  private logger: Logger;
  private configModule: ConfigModule;

  constructor({ logger, configModule }: InjectedDependencies, options: ModuleOptions) {
    this.logger = logger;
    this.options = options;
    this.configModule = configModule;
  }

  async computeActions(promotionCodes: string[], cart: CartDTO): Promise<ComputeActions[]> {
    const computedActions: PromotionTypes.ComputeActions[] = [];
    const { items = [], shipping_methods: shippingMethods = [] } = cart;

    const codeAdjustmentMap = new Map<
      string,
      {
        items: LineItemAdjustmentDTO[];
        shipping: ShippingMethodAdjustmentDTO[];
      }
    >();

    for (const item of items) {
      if (!item.adjustments?.length) continue;

      for (const adjustment of item.adjustments) {
        if (!isString(adjustment.code)) continue;

        if (!codeAdjustmentMap.has(adjustment.code)) {
          codeAdjustmentMap.set(adjustment.code, { items: [], shipping: [] });
        }

        codeAdjustmentMap.get(adjustment.code)!.items.push(adjustment);
      }
    }

    for (const shippingMethod of shippingMethods) {
      if (!shippingMethod.adjustments?.length) continue;

      for (const adjustment of shippingMethod.adjustments) {
        if (!isString(adjustment.code)) continue;

        if (!codeAdjustmentMap.has(adjustment.code)) {
          codeAdjustmentMap.set(adjustment.code, { items: [], shipping: [] });
        }

        codeAdjustmentMap.get(adjustment.code)!.shipping.push(adjustment);
      }
    }

    for (const [code, adjustments] of codeAdjustmentMap.entries()) {
      for (const adjustment of adjustments.items) {
        computedActions.push({
          action: ComputedActions.REMOVE_ITEM_ADJUSTMENT,
          adjustment_id: adjustment.id,
          code,
        });
      }

      for (const adjustment of adjustments.shipping) {
        computedActions.push({
          action: ComputedActions.REMOVE_SHIPPING_METHOD_ADJUSTMENT,
          adjustment_id: adjustment.id,
          code,
        });
      }
    }

    const appliedCodes = Array.from(codeAdjustmentMap.keys());
    const promotionCodesToApply = [...promotionCodes, ...appliedCodes];
    const uniquePromotionCodes = Array.from(new Set(promotionCodesToApply));
    const integrationState = await this.updateCustomerSessionV2(cart, uniquePromotionCodes);

    if (isDefined(integrationState)) {
      console.log("Integration State:", JSON.stringify(integrationState, null, 2));
      const actions = this.buildTalonOneComputedActions(cart, integrationState.effects);
      if (isDefined(actions)) {
        computedActions.push(...actions);
      }
    }

    console.log("Computed Actions:", computedActions);
    return computedActions;
  }

  async updateCustomerSessionV2(
    cart: CartDTO,
    promotionCodes: string[],
    state: string = "open"
  ): Promise<IntegrationStateV2> {
    const talonItems = (cart.items ?? []).map((i) => ({
      name: i.product_title,
      sku: i.variant_sku ?? "",
      quantity: Number(i.quantity),
      price:
        typeof i.unit_price === "object" && "toNumber" in i.unit_price
          ? i.unit_price.toNumber()
          : Number(i.unit_price),
    }));

    const session = {
      profileId: cart.customer_id ?? cart.id,
      cartItems: talonItems,
      couponCodes: promotionCodes,
      state,
    };

    console.log("TalonOne Session:", JSON.stringify(session, null, 2));

    const integrationState = await integrationApi.updateCustomerSessionV2(cart.id, {
      customerSession: session,
    });

    return integrationState;
  }

  buildTalonOneComputedActions(cart: CartDTO, effects: TalonEffect[]): ComputeActions[] {
    const actions: ComputeActions[] = [];

    const codeMap = new Map<string, string>();
    effects.forEach((e) => {
      if (e.effectType === "acceptCoupon" && isString(e.props.value)) {
        const key = `${e.campaignId}-${e.rulesetId}`;
        codeMap.set(key, e.props.value as string);
      }
    });

    const discountAcc: Record<string, Record<number, number>> = {};
    effects.forEach((e) => {
      if (e.effectType === "setDiscountPerItem") {
        const key = `${e.campaignId}-${e.rulesetId}`;
        const pos = e.props.position ?? 0;
        const val = Number(e.props.value ?? 0);

        if (!discountAcc[key]) {
          discountAcc[key] = {};
        }
        discountAcc[key][pos] = (discountAcc[key][pos] || 0) + val;
      }
    });

    Object.entries(discountAcc).forEach(([key, posMap]) => {
      const code = codeMap.get(key);

      Object.entries(posMap).forEach(([posStr, totalDiscount]) => {
        const pos = Number(posStr);
        const item = cart.items?.[pos];
        if (!item) {
          return;
        }

        const baseAction: Record<string, any> = {
          action: ComputedActions.ADD_ITEM_ADJUSTMENT,
          item_id: item.id,
          amount: totalDiscount,
        };

        if (code) {
          baseAction.code = code;
        }

        actions.push(baseAction as ComputeActions);
      });
    });

    return actions;
  }
}

export default TalonOneModuleService;
