# MedusaJS + Talon One POC

## Overview

This repository is a **proof of concept** demonstrating how to integrate an external promotion engine into MedusaJS. As of MedusaJS v2.7.1, there is no built-in mechanism for external promotion types, so this POC shows how to plug one in. In this example, we’re using [Talon One](https://www.talon.one/) to evaluate and apply coupons, discounts, and other promotional effects.

> **Note:** Not all Talon One effect types have been implemented here—this POC focuses on basic per-item discounts via `setDiscountPerItem` and coupon acceptance via `acceptCoupon`.

---

## Compatibility

- **MedusaJS:** v2.7.1 and above
  - This integration relies on the `beforeRefreshingPaymentCollection` hook introduced (published) in MedusaJS v2.7.1+
- **Talon One SDK:** [`talon_one`](https://www.npmjs.com/package/talon_one)

---

## Implementation

This proof-of-concept reuses Medusa’s built-in `updateCartPromotionsWorkflow` as much as possible, but swaps in a custom step to call Talon One and translate its response into Medusa `ComputedActions`.

1. **Workflow definition**  
   - We register a new workflow with ID `update-cart-external-promotions`.  
   - It mirrors the out-of-the-box `updateCartPromotionsWorkflow`, leveraging the same core-flows steps:  
     1. **Fetch or reuse** the cart (`useRemoteQueryStep`)  
     2. **Extract** incoming `promo_codes` (`getExternalPromotionCodesToApply`)  
     3. **Remove** existing adjustments (`removeLineItemAdjustmentsStep`, `removeShippingMethodAdjustmentsStep`)  
     4. **Call external promotions** (`updateCustomerSessionStep`)  
     5. **Prepare** adjustments from actions (`prepareAdjustmentsFromPromotionActionsStep`)  
     6. **Apply** new adjustments (`createLineItemAdjustmentsStep`, `createShippingMethodAdjustmentsStep`)  
     7. **Refetch** the cart to return updated totals

2. **Hook integration point**  
   - - We trigger our workflow at the same place Medusa applies built-in promotions during the `refreshCartItemsWorkflow` execution, using the `beforeRefreshingPaymentCollection` hook—which is published right after the `updateCartPromotionsWorkflow` runs.
     ```ts
     import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows";
     import { updateCartExternalPromotionsWorkflow } from "../talon-one/workflows/update-cart-external-promotions";

     refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection(
       async ({ input: { cart_id, promo_codes } }, { container }) => {
         await updateCartExternalPromotionsWorkflow(container).run({
           input: { cart_id, promo_codes },
         });
       }
     );
     ```

3. **Custom Talon One step**  
   - Instead of Medusa’s default promotions step, we invoke:
     ```ts
     const actions = updateCustomerSessionStep({
       cart,
       promotionCodesToApply,
     });
     ```
   - Under the hood, `updateCustomerSessionStep` calls `TalonOneModuleService.computeActions(promotionCodes: string[], cart: CartDTO)`.  
   - That service:  
     1. Sends the cart + codes to Talon One via `updateCustomerSessionV2`  
     2. Receives `IntegrationStateV2.effects`  
     3. Converts those `effects` into Medusa `ADD_ITEM_ADJUSTMENT` `ComputedActions`

4. **Module registration**  
   - In `medusa-config.ts`, we wire in our module:
     ```ts
     modules: {
       [TALON_ONE_MODULE]: {
         resolve: "./src/modules/talon-one",
         options: {
           basePath:     process.env.TALON_ONE_BASE_PATH,
           apiKey:       process.env.TALON_ONE_API_KEY,
           apiKeyPrefix: process.env.TALON_ONE_API_KEY_PREFIX,
         },
       },
     },
     ```
   - This injects your `.env` credentials into `TalonOneModuleService` so `computeActions` can talk to the Talon One API.

By slotting our Talon One call into the existing promotions workflow, we reuse Medusa’s removal/creation steps and simply delegate all discount logic to Talon One.

---

## Limitations

- Only `acceptCoupon` and `setDiscountPerItem` effects are supported.
- We are only calling `updateCustomerSessionV2` with `state=open` during cart line updates.
- To support coupon-code-based promotions, you must create a MedusaJS promotion with the desired coupon code; otherwise the promotion won’t be linked to the cart, the code will be removed, and the cart will be updated. One possible workaround is implementing your own promotions model and admin UI, but note that doing so requires replacing some of the MedusaJS steps we currently reuse and implementing your own. Promotions that are automatically applied without a coupon do not have this limitation.

---

## Contributing

Improvements and pull requests are welcome! If you’d like to add support for additional Talon One effect types, tests or enhance error handling, please:

1. Fork this repository
2. Create a feature branch (e.g. `feat/feature-name`)
3. Submit a pull request with tests and documentation updates

---

## Prerequisites

1. A running MedusaJS backend (v2.7.1+)  
2. A Talon One account with an **Integration API** key  
3. Environment variables set in your Medusa project’s `.env`:  
   ```bash
   TALON_ONE_BASE_PATH=https://<your-instance>.talon.one
   TALON_ONE_API_KEY=<your-integration-api-key>
   TALON_ONE_API_KEY_PREFIX=ApiKey-v1

## License

This project is licensed under the [MIT License](LICENSE).