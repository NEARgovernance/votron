import { requestSignIn } from "@fastnear/api";
import { Constants } from "../hooks/constants.js";

export function SignIn(props) {
  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() =>
          requestSignIn({ contractId: Constants.VENEAR_CONTRACT_ID })
        }
      >
        Sign In
      </button>
    </>
  );
}
