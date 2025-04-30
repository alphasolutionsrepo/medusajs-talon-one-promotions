import {
  createWorkflow,
  parallelize,
  transform,
  when,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createLineItemAdjustmentsStep,
  createShippingMethodAdjustmentsStep,
  prepareAdjustmentsFromPromotionActionsStep,
  removeLineItemAdjustmentsStep,
  removeShippingMethodAdjustmentsStep,
  useRemoteQueryStep,
} from "@medusajs/medusa/core-flows";
import { updateCustomerSessionStep } from "../steps/update-customer-session";
import { getExternalPromotionCodesToApply } from "../steps/get-external-promotion-codes-to-apply";

export type UpdateCartExternalPromotionsWorkflowInput = {
  cart_id?: string;
  cart?: any;
  promo_codes?: string[];
};

export const updateCartExternalPromotionsWorkflowId = "update-cart-external-promotions";

const cartFields = [
  "id",
  "quantity",
  "subtotal",
  "item_total",
  "total",
  "item_subtotal",
  "shipping_subtotal",
  "items.*",
  "items.product.id",
  "items.variant.id",
  "items.variant.product.id",
  "items.adjustments.*",
  "shipping_methods.*",
  "shipping_methods.adjustments.*",
  "promotions.code",
];

export const updateCartExternalPromotionsWorkflow = createWorkflow(
  updateCartExternalPromotionsWorkflowId,
  (input: WorkflowData<UpdateCartExternalPromotionsWorkflowInput>) => {
    const fetchCart = when({ input }, ({ input }) => {
      return !input.cart;
    }).then(() => {
      return useRemoteQueryStep({
        entry_point: "cart",
        fields: cartFields,
        variables: { id: input.cart_id },
        list: false,
      });
    });

    const cart = transform({ fetchCart, input }, ({ fetchCart, input }) => {
      return input.cart ?? fetchCart;
    });

    const promo_codes = transform({ input }, (data) => {
      return (data.input.promo_codes || []) as string[];
    });

    const promotionCodesToApply = getExternalPromotionCodesToApply({
      cart: cart,
      promo_codes,
    });

    const actions = updateCustomerSessionStep({
      cart,
      promotionCodesToApply: promotionCodesToApply,
    });

    const {
      lineItemAdjustmentsToCreate,
      lineItemAdjustmentIdsToRemove,
      shippingMethodAdjustmentsToCreate,
      shippingMethodAdjustmentIdsToRemove,
    } = prepareAdjustmentsFromPromotionActionsStep({ actions });

    parallelize(
      removeLineItemAdjustmentsStep({ lineItemAdjustmentIdsToRemove }),
      removeShippingMethodAdjustmentsStep({
        shippingMethodAdjustmentIdsToRemove,
      }),
      createLineItemAdjustmentsStep({ lineItemAdjustmentsToCreate }),
      createShippingMethodAdjustmentsStep({
        shippingMethodAdjustmentsToCreate,
      })
    );

    const refetchedCart = useRemoteQueryStep({
      entry_point: "cart",
      fields: cartFields,
      variables: { id: input.cart_id },
      list: false,
    }).config({ name: "refetch–cart" });

    return new WorkflowResponse(refetchedCart);
  }
);
