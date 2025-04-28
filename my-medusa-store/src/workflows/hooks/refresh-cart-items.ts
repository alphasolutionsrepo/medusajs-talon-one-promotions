import { ContainerRegistrationKeys, remoteQueryObjectFromString } from "@medusajs/framework/utils";
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows";
import { updateCartExternalPromotionsWorkflow } from "../talon-one/workflows/update-cart-external-promotions";

const cartFields = [
  "id",
  "quantity",
  "subtotal",
  "item_total",
  "total",
  "item_subtotal",
  "shipping_subtotal",
  "items.product.id",
  "items.variant.id",
  "items.variant.product.id",
  "items.adjustments.*",
  "shipping_methods.adjustments.*",
  "promotions.code",
];

refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection(
  async ({ input: { cart_id, promo_codes } }, { container }) => {
    const logger = container.resolve("logger");
    const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

    logger.info(`beforeRefreshingPaymentCollection(hooks) - cart_id: ${cart_id}`);
    logger.info(
      `beforeRefreshingPaymentCollection(hooks) - promo_codes: ${JSON.stringify(
        promo_codes,
        null,
        2
      )}`
    );

    const queryObject = remoteQueryObjectFromString({
      entryPoint: "cart",
      variables: { filters: { id: cart_id } },
      fields: cartFields,
    });
    const queryResult = await remoteQuery(queryObject);
    console.log(
      "updateCartExternalPromotionsWorkflow(hooks) - cart:",
      JSON.stringify(queryResult, null, 2)
    );

    const { result } = await updateCartExternalPromotionsWorkflow(container).run({
      input: {
        cart_id: cart_id,
        promo_codes: promo_codes,
      },
    });

    console.log(
      "updateCartExternalPromotionsWorkflow(hooks) - result:",
      JSON.stringify(result, null, 2)
    );
  }
);
