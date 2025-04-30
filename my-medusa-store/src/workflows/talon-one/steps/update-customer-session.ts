import { CartDTO } from "@medusajs/framework/types";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { TALON_ONE_MODULE } from "../../../modules/talon-one";
import { ITalonOneModuleService } from "../../../types/talon-one/service";

export interface updateCustomerSessionStepInput {
  cart: CartDTO;
  promotionCodesToApply: string[];
}

export const updateCustomerSessionStepId = "update-customer-session";

export const updateCustomerSessionStep = createStep(
  updateCustomerSessionStepId,
  async (data: updateCustomerSessionStepInput, { container }) => {
    const logger = container.resolve("logger");

    const { cart, promotionCodesToApply = [] } = data;

    logger.info(
      `updateCustomerSessionStep: cart_id=${cart.id}, promotionCodesToApply=${promotionCodesToApply}`
    );

    const talonOneService = container.resolve<ITalonOneModuleService>(TALON_ONE_MODULE);
    const actionsToCompute = await talonOneService.computeActions(promotionCodesToApply, cart);

    return new StepResponse(actionsToCompute);
  }
);
