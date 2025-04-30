import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows";
import { updateCartExternalPromotionsWorkflow } from "../talon-one/workflows/update-cart-external-promotions";

refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection(
  async ({ input: { cart_id, promo_codes } }, { container }) => {
    await updateCartExternalPromotionsWorkflow(container).run({
      input: {
        cart_id: cart_id,
        promo_codes: promo_codes,
      },
    });
  }
);
