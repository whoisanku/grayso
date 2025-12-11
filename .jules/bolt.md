## 2024-05-23 - FlashList Caveats
**Learning:** The installed version of `@shopify/flash-list` (2.2.0) in this repo appears to lack `estimatedItemSize` and `inverted` in its type definitions and possibly implementation, contrary to standard documentation. It behaves closer to a raw `RecyclerView`.
**Action:** When migrating to FlashList in this codebase, manual inversion (transform scaleY: -1) and omitting `estimatedItemSize` is required. Also, state in recycled components must be manually reset using `useEffect`.
