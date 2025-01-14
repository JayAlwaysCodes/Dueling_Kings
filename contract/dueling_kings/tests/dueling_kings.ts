import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { DuelingKings } from "../target/types/dueling_kings";

describe("dueling_kings", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.DuelingKings as Program<DuelingKings>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
