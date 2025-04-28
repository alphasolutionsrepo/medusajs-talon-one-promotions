import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk";

export interface GetExternalPromotionCodesToApplyStepInput {
  cart: {
    items?: { adjustments?: { code?: string }[] }[];
    shipping_methods?: { adjustments?: { code?: string }[] }[];
  };
  promo_codes?: string[];
}

export type GetExternalPromotionCodesToApplyStepOutput = string[];

export const getExternalPromotionCodesToApplyId = "get-external-promotion-codes-to-apply";

export const getExternalPromotionCodesToApply = createStep(
  getExternalPromotionCodesToApplyId,
  async (data: GetExternalPromotionCodesToApplyStepInput, { container }) => {
    const { promo_codes = [], cart } = data;
    const { items = [], shipping_methods = [] } = cart;
    const adjustmentCodes: string[] = [];

    const objects = items.concat(shipping_methods);
    objects.forEach((object) => {
      object.adjustments?.forEach((adjustment) => {
        if (adjustment.code && !adjustmentCodes.includes(adjustment.code)) {
          adjustmentCodes.push(adjustment.code);
        }
      });
    });

    console.log(
      "getExternalPromotionCodesToApply - adjustmentCodes:",
      JSON.stringify(adjustmentCodes, null, 2)
    );

    const mergedCodes: string[] = [...new Set([...(promo_codes ?? []), ...adjustmentCodes])];

    console.log(
      "getExternalPromotionCodesToApply - mergedCodes:",
      JSON.stringify(mergedCodes, null, 2)
    );

    return new StepResponse(mergedCodes as GetExternalPromotionCodesToApplyStepOutput);
  }
);
