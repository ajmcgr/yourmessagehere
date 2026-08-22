import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_INCREMENT_CENTS,
  DEFAULT_STARTING_BID_CENTS,
  fetchCurrentAuction,
  fetchLiveBillboard,
  fetchTopBids,
  nextAuctionEnd,
  type Auction,
  type Bid,
  type Billboard,
} from "@/lib/ymh";

export function useAuction() {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [billboard, setBillboard] = useState<Billboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const a = await fetchCurrentAuction();
    setAuction(a);
    const [b, bb] = await Promise.all([fetchTopBids(a?.id), fetchLiveBillboard()]);
    setBids(b);
    setBillboard(bb);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  // Realtime: new bids on the current auction
  useEffect(() => {
    const client = supabase;
    if (!client || !auction?.id) return;
    const channel = client
      .channel(`ymh_auction_${auction.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ymh_auctions", filter: `id=eq.${auction.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [auction?.id]);

  const endsAt = useMemo(
    () => (auction?.ends_at ? new Date(auction.ends_at) : nextAuctionEnd()),
    [auction?.ends_at],
  );

  // Weekly rollover: the moment this auction's deadline passes, ask the server
  // for the new one. Retries so an open tab never sits on 00:00:00.
  useEffect(() => {
    if (loading) return;
    const msLeft = endsAt.getTime() - Date.now();
    if (msLeft > 0) {
      const id = window.setTimeout(() => void load(), msLeft + 1500);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(id);
  }, [endsAt.getTime(), loading]);

  // Derive from real bid rows so deleted bids disappear immediately.
  const currentBidCents = bids[0]?.amount_cents ?? null;
  const startingBidCents = auction?.starting_bid_cents ?? DEFAULT_STARTING_BID_CENTS;
  const incrementCents = auction?.min_increment_cents ?? DEFAULT_INCREMENT_CENTS;
  const minBidCents =
    currentBidCents === null ? startingBidCents : currentBidCents + incrementCents;


  return {
    auction,
    bids,
    billboard,
    loading,
    endsAt,
    currentBidCents,
    startingBidCents,
    incrementCents,
    minBidCents,
    reload: load,
  };
}
