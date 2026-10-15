import type { UserRightsKey, UserRightsRefusal } from "../../userRights/userRightsContract";

/** Un refus du contrat des droits (`{ error, fields? }`), levé par le service, rendu par la route. */
export class UserRightsFailure extends Error {
  constructor(
    readonly code: UserRightsRefusal,
    readonly fields?: UserRightsKey[],
  ) {
    super(code);
    this.name = "UserRightsFailure";
  }
}
