import { signOut } from "@fastnear/api";

export function SignOut(props) {
  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => signOut()}>
        Sign Out
      </button>
    </>
  );
}
