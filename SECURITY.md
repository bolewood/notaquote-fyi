# Security

NotAQuote.FYI has no accounts and no database of visitors. Your inputs stay in your browser. Even so, if you find a way for the site to leak someone's inputs, run code it shouldn't, or send data somewhere it shouldn't, we want to know.

## How to report a problem

Please don't open a public issue for a security problem. Instead, use GitHub's private reporting: go to the repository's **Security** tab and choose **Report a vulnerability**, or open [a new private advisory](https://github.com/bolewood/notaquote-fyi/security/advisories/new) directly.

Tell us what you found, how to reproduce it, and what you think the impact is. We'll reply there.

## What's in scope

- Anything that sends a premium, a VIN, or scenario inputs off the visitor's device, other than the VIN decode request to NHTSA that the Privacy page describes.
- Script injection through share links, "Suggest a fix" links, or any other input.
- Problems with how the site is built or deployed from this repository.

Wrong numbers, missing state rules, and misclassified cars aren't security problems. Please use the [regular issue forms](https://github.com/bolewood/notaquote-fyi/issues/new/choose) for those.
