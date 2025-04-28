import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, remoteQueryObjectFromString } from "@medusajs/framework/utils";

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

export default async function cartUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");
  const remoteQuery = container.resolve(ContainerRegistrationKeys.REMOTE_QUERY);

  logger.info(`Cart updated event received: ${data.id}`);

  const { id } = data;
  const queryObject = remoteQueryObjectFromString({
    entryPoint: "cart",
    variables: { filters: { id } },
    fields: cartFields,
  });
  const queryResult = await remoteQuery(queryObject);
  // console.log("Cart:", JSON.stringify(queryResult, null, 2));
}

export const config: SubscriberConfig = {
  event: "cart.updated",
};
