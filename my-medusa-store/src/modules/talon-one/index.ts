import { Module } from "@medusajs/framework/utils";
import TalonOneModuleService from "./service";

export const TALON_ONE_MODULE = "talon_one";

export default Module(TALON_ONE_MODULE, {
  service: TalonOneModuleService,
});
