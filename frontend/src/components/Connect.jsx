import { useAccount } from "../hooks/useAccount.js";
import { SignIn } from "./SignIn.jsx";
import { SignOut } from "./SignOut.jsx";

export function Connect(props) {
  const accountId = useAccount();

  return accountId ? (
    <SignOut accountId={accountId} props={{ ...props }} />
  ) : (
    <SignIn props={{ ...props }} />
  );
}
