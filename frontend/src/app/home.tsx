import { Link } from "react-router";

export function Component() {
  return (
    <>
      <section className="hero">
        <div className="site-width hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true" /> Panchagarh, Bangladesh
            </p>
            <h1>
              From tea garden <em>to factory.</em>
            </h1>
            <p className="hero-summary">
              ChaBondhu connects local growers and tea factories to share
              harvests, agree on prices, and coordinate pickup.
            </p>
            <div className="hero-actions">
              <Link className="button button-leaf" to="/register">
                Get started <span aria-hidden="true">↗</span>
              </Link>
              <a className="button hero-secondary" href="#marketplace">
                How it works <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <figure className="hero-photo">
            <img
              src="/tea-garden.jpg"
              alt="Tea workers harvesting leaves in a Panchagarh tea garden"
              width="1280"
              height="828"
              fetchPriority="high"
            />
            <figcaption>
              <strong>Tea gardens of Panchagarh</strong>
              <a href="https://commons.wikimedia.org/wiki/File:Tea_Garden_in_Panchagarh_(cropped).jpg">
                Nazmul Hossain Nisad
              </a>
              <span aria-hidden="true"> · </span>
              <a href="https://creativecommons.org/licenses/by-sa/4.0/">
                CC BY-SA 4.0
              </a>
            </figcaption>
          </figure>
        </div>
      </section>
      <section
        className="site-width audience"
        id="marketplace"
        aria-labelledby="marketplace-title"
      >
        <h2 id="marketplace-title">How the marketplace works</h2>
        <div className="audience-grid">
          <article id="growers" className="audience-card">
            <h3>For growers</h3>
            <p>
              Share your next harvest, review requests from factories, and
              confirm receipt of payment.
            </p>
          </article>
          <article id="factories" className="audience-card">
            <h3>For factories</h3>
            <p>
              Browse harvest listings, publish buying offers after verification,
              and manage pickup and settlement.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
