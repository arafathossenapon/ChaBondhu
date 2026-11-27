import { Link, useNavigate, useParams } from "react-router";
import { ApiError } from "../../shared/api/api-error";
import { useSession } from "../auth/session-context";
import { validId, type Listing } from "../marketplace/contracts";
import { LoadingCards, MarketError } from "../marketplace/ui";
import { ListingForm, type ListingBody } from "./listing-form";
import { canEdit, useGrowerListings, useListingCache } from "./listings";

export function CreateListingPage() {
  const { request } = useSession();
  const navigate = useNavigate();
  const updateCache = useListingCache();
  async function save(body: ListingBody) {
    const listing = await request<Listing>("/listings", {
      method: "POST",
      body,
    });
    await updateCache(listing);
    navigate("/grower/listings/" + listing.id, {
      replace: true,
      state: { notice: "Listing published." },
    });
  }
  return (
    <>
      <EditorHeading title="Post a harvest" />
      <section className="grower-section" aria-label="Create harvest listing">
        <p>
          Published listings are active and discoverable. You can edit an active
          listing and withdraw an eligible listing from the marketplace.
        </p>
        <ListingForm save={save} />
        <Link className="text-tea underline" to="/grower">
          Complete your grower profile
        </Link>{" "}
        before posting your first harvest.
      </section>
    </>
  );
}

export function EditListingPage() {
  const { id } = useParams();
  const { request } = useSession();
  const navigate = useNavigate();
  const updateCache = useListingCache();
  const listings = useGrowerListings();
  const listing = validId(id)
    ? listings.data?.find((item) => item.id === Number(id))
    : undefined;

  return (
    <>
      <EditorHeading title="Edit harvest listing" />
      <section className="grower-section" aria-label="Edit harvest listing">
        {listings.isPending ? (
          <LoadingCards />
        ) : listings.isError ? (
          <MarketError
            error={listings.error}
            retry={() => void listings.refetch()}
          />
        ) : !listing ? (
          <p role="alert" className="market-card">
            This listing is unavailable in your harvests.
          </p>
        ) : !canEdit(listing) ? (
          <p role="alert" className="market-card">
            Only active, available listings can be edited.
          </p>
        ) : (
          <ListingForm
            key={listing.id}
            listing={listing}
            save={async (body) => {
              try {
                const updated = await request<Listing>(
                  "/listings/" + listing.id,
                  { method: "PATCH", body },
                );
                await updateCache(updated);
                navigate("/grower/listings/" + listing.id, {
                  replace: true,
                  state: { notice: "Listing updated." },
                });
              } catch (error) {
                if (error instanceof ApiError && error.status === 403)
                  void listings.refetch();
                throw error;
              }
            }}
          />
        )}
      </section>
    </>
  );
}

function EditorHeading({ title }: { title: string }) {
  return (
    <header className="grower-heading">
      <h1>{title}</h1>
      <Link className="button hero-secondary" to="/grower/listings">
        Back to my listings
      </Link>
    </header>
  );
}
