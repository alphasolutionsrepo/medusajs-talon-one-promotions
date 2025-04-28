import { CartDTO, ComputeActions, IModuleService } from "@medusajs/framework/types";

export interface ITalonOneModuleService extends IModuleService {
  computeActions(promotionCodes: string[], cart: CartDTO): Promise<ComputeActions[]>;
}
