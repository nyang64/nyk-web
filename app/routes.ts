import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("hashed-lierre", "routes/hashed-lierre.tsx"),
  route("nswap", "routes/nswap.tsx"),
  route("registration", "routes/registration.tsx"),
  route("presale", "routes/presale.tsx"),  // temporarily disabled
  route("purchase-crypto", "routes/purchase-crypto.tsx"),
  // route("product", "routes/product.tsx"),  // DeID Replicator — temporarily hidden
  route("ngx", "routes/ngx.tsx"),
  route("verified", "routes/verified.tsx"),
  route("faq", "routes/faq.tsx"),
  route("about", "routes/about.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("puzzle", "routes/puzzle.tsx"),
  route("lp-manager", "routes/lp-manager.tsx"),
  route("lp-vault-docs", "routes/lp-vault-docs.tsx"),
] satisfies RouteConfig;
