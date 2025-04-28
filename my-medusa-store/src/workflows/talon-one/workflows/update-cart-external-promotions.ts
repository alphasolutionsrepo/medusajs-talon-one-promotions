import { PromotionActions } from "@medusajs/framework/utils";
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
  updateCartPromotionsStep,
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

const cartFieldsForRefreshSteps = [
  "id",
  "currency_code",
  "quantity",
  "subtotal",
  "item_total",
  "total",
  "item_subtotal",
  "shipping_subtotal",
  "region_id",
  "metadata",
  "completed_at",
  "sales_channel_id",
  "region.*",
  "items.*",
  "items.product.id",
  "items.product.is_giftcard",
  "items.product.collection_id",
  "items.product.categories.id",
  "items.product.tags.id",
  "items.product.type_id",
  "items.variant.id",
  "items.variant.product.id",
  "items.variant.weight",
  "items.variant.length",
  "items.variant.height",
  "items.variant.width",
  "items.variant.material",
  "items.adjustments.*",
  "items.tax_lines.*",
  "shipping_address.*",
  "shipping_methods.*",
  "shipping_methods.adjustments.*",
  "shipping_methods.tax_lines.*",
  "customer.*",
  "customer.groups.*",
  "promotions.code",
  "payment_collection.id",
  "payment_collection.raw_amount",
  "payment_collection.amount",
  "payment_collection.currency_code",
  "payment_collection.payment_sessions.id",
];

export const updateCartExternalPromotionsWorkflow = createWorkflow(
  updateCartExternalPromotionsWorkflowId,
  (input: WorkflowData<UpdateCartExternalPromotionsWorkflowInput>) => {
    const fetchCart = when({ input }, ({ input }) => {
      return !input.cart;
    }).then(() => {
      return useRemoteQueryStep({
        entry_point: "cart",
        fields: cartFieldsForRefreshSteps,
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
      // computedPromotionCodes,
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
      // updateCartPromotionsStep({
      //   id: cart.id,
      //   promo_codes: computedPromotionCodes,
      //   action: PromotionActions.REPLACE,
      // })
    );

    const refetchedCart = useRemoteQueryStep({
      entry_point: "cart",
      fields: cartFieldsForRefreshSteps,
      variables: { id: input.cart_id },
      list: false,
    }).config({ name: "refetch–cart" });

    return new WorkflowResponse(refetchedCart);
  }
);
