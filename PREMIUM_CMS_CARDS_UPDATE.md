# Premium CMS Cards Update

- About Us CMS body is now parsed into responsive premium content cards instead of one long text column.
- Contact Us duplicate CMS section ("Before you message / Contact Us / We are here to help") is removed from the public page.
- Contact form and direct support cards remain intact.
- Blog no longer imports or renders `STATIC_BLOG_POSTS`.
- The old static Blog fallback entry was removed from `dummy-content.ts`.
- The legacy seeded placeholder Blog copy is detected and suppressed so it does not appear publicly.
- Blog now has a premium image-led showcase using the existing local WebP hero asset.
- Real published Blog CMS sections are turned into premium cards automatically.
- If no real Blog content is published, a clean branded empty state is shown instead of mock articles.
