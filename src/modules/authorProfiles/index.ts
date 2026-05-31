import { registerAuthorProfileMenu, unregisterAuthorProfileMenu } from "./menu";

export function registerAuthorProfiles(): void {
  registerAuthorProfileMenu();
}

export function shutdownAuthorProfiles(): void {
  unregisterAuthorProfileMenu();
}
