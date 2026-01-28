# Roadmap

Describes the high-level features and actions for the Meteor project in the near-to-medium term future.

## Introduction

**Last updated: January 30, 2026.**

The description of many items includes sentences and ideas from Meteor community members.

Contributors are encouraged to focus their efforts on work that aligns with the roadmap then we can work together in these areas.

> As with any roadmap, this is a living document that will evolve as priorities and dependencies shift.

> If you have new feature requests or ideas, you should open a new [discussion](https://github.com/meteor/meteor/discussions/new).

## Current project: Bundle optimization

> We need to improve the bundle size and performance of Meteor apps. We should consider tree-shaking, code-splitting,
> and other optimizations to make our apps leaner and faster.
> To achieve that we plan to integrate or have an easy way to integrate with modern bundlers like Rspack.

**Release articles**

🔗 [Unlocking Meteor 3.2: New Profiling Tool to Track Bundler Performance and Size](https://dev.to/meteor/unlocking-meteor-32-new-profiling-tool-to-track-bundler-performance-and-size-1jc8)

🔗 [Faster Builds in Meteor 3.3: Modern Build Stack with SWC and Bundler Optimizations](https://dev.to/meteor/faster-builds-in-meteor-33-modern-build-stack-with-swc-and-bundler-optimizations-fm2)

🔗 TODO - Add link to the next 3.4 article

**Feedback and discussion**

💬 TODO -  Add link to the new 3.4 forum post for feedback

### Implementation plan:

#### Phase 1: Profiling

**Target Release:** 3.2 ✅

**Goal:** Add a command([meteor profile](/cli/#meteorprofile)) to measure if our changes are actually making our builds faster and smaller.


#### Phase 2: External Transpiler Integration

**Target Release:** 3.3 ✅

**Goal:** For this phase we want:
 - Improve our current bundler performance, via optimizations so that any meteor user can get benefits from it; And an external bundler could get
   the same benefits.
 - To have an external transpiler working with Meteor and producing a bundle that is smaller or faster than the current Meteor bundle.


#### Phase 3: HMR Improvements

**Target Release:** 3.3 ✅

**Goal:** Improve the HMR performance, so that it is faster and more reliable on what needs to be changed.

#### Phase 4: Bundler Improvements & Feedback

**Target Release:** 3.3.2 ✅

**Goal:** Improve the build size and make meteor use less resources for building, decreasing even more build and rebuild time.
- Expanding compatibility and updates based on the feedback from the community, so that we can have a better experience with our new build tools, in this case SWC

#### Phase 5: External Bundler integration

**Target Release:** 3.4 ✅

**Goal:** Integrate an external bundler like Rspack with Meteor, producing a bundle that is smaller or faster than the current Meteor bundle.
- This also enables features like tree-shaking, code-splitting, full ESM support, community plugins, and other optimizations that make Meteor apps leaner, faster, and more standardized to configure.

#### Phase 6: Resource Optimization & Feedback

**Target Release:** 3.4.x ⏳

**Goal:** Improve memory consumption on large apps when using Meteor and Rspack. This comes mainly from [identified optimizations on the Meteor side](https://forums.meteor.com/t/3-4-rc-3-release-candidate-faster-builds-smaller-bundles-and-modern-setups-with-the-rspack-integration/64124/225), and also from [new improvements in Rspack 2.0](https://rspack.rs/misc/planning/roadmap) as they become available.
- Expanding compatibility and updates based on community feedback, to improve the experience when working with the integrated Rspack bundler, like a clearer debugging process, more stable testing flows, and better support for different kinds of projects.

#### Documentation Strategy

We plan to document the changes in the Meteor documentation, including:
* How to use the new features
* How to integrate with the new bundler
* How the Meteor bundler pipeline works for future contributors
* Examples and guides for integrating with the new bundler

## Next project: Change streams

> Provide a unified API for MongoDB change notifications to improve efficiency and consistency.

**Feedback and discussion**

🔗 [MongoDB Change Streams support in Meteor](https://forums.meteor.com/t/mongodb-change-streams-support-in-meteor/63681)

### TODO Develop the sections of release phases

## Next priorities

The priorities listed below represent tasks that are large enough to be considered major items we want to pursue next, similar to bundler optimizations and change streams.

* Mobile/Capacitor Support
* Release CI/CD Speed & Reliability
* TypeScript Improvements
* Client-side Type Safety
* Test Support Improvements

We will expand their descriptions and open feedback channels once we have time to address them.

Beyond these, we also track smaller tasks delivered in each release. These focus on improving existing areas in Meteor (such as Node 24, OpenTelemetry, Express Auth integration, and more), enforcing Meteor core code quality (linting and standards), easing contributions through documentation and engagement programs, and reviewing and validating existing and new community contributions.

---

For more completed items, refer to our [changelog](https://docs.meteor.com/history.html).
