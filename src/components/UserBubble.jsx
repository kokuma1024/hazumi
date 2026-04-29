import { S } from "../styles";

export function UserBubble({ text, ts }) {
  return (
    <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "80%" }}>
      {ts && <div style={S.msgTsRight}>{ts}</div>}
      <div style={{ ...S.userBubble, alignSelf: "unset", maxWidth: "unset" }}>{text}</div>
    </div>
  );
}
