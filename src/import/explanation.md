Speedscope tries to merge the garbage collection stack frames on top of the previous stack (merged in 2018 https://github.com/jlfwong/speedscope/pull/85), but since stackprof merged this PR (https://github.com/tmm1/stackprof/pull/129) in 2019, stacks for GC can now have a depth of 2  by creating sub frames for `(marking)` and `(sweeping)`.

This causes the existing GC patch to not work anymore, and the GC stack frames are now shown as root frames.

```js
// Current version that only contacts single frame garbage collection stacks
if (stack.length === 1 && stack[0].name === '(garbage collection)') {
  stack = prevStack.concat(stack)
}
```

This means that when visualizing flamegraphs in speedscope we will still see GC stacks as root frames:

> image of current behavior

This is how how the raw importing of stackprof looked like:

> image without filter


The original PR changing the stackprof imported in speedscope to merge was merged 5 years ago (https://github.com/jlfwong/speedscope/pull/85), and it seems to be a behavior they are interested in keeping (https://github.com/jlfwong/speedscope/pull/178#issuecomment-443959686).

We could improve this by concatenating all frames from a stack if it start with GC frame:

```js
if (stack[0].name === '(garbage collection)') {
  stack = prevStack.concat(stack)
}
```

This improves the output by not showing GC stacks as root frames, but it creates a bit of a mess when multiple GC stacks are concatenated:

> image with concatenation

I've explored the idea of doing some clever merging of current stack into previous stack starting merge only on GC frames, but that code became complex/slow, so I dropped that idea for now.

I though maybe we could drop all sub frames in GC stack by appending a single GC frame to previous stack if it wasn't already a GC frame:

```js
// Concatenate single garbage collection frame to previous stack instead of showing it as root stack
if (stack[0].name === '(garbage collection)') {
  // When the last previous stack frame is garbage collection then we can reuse that stack
  if (prevStack[prevStack.length - 1].name === '(garbage collection)') {
    stack = prevStack
  } else {
    // We want to merge a single garbage collection frame with the previous stack.
    // Stackprof can return sub frames like `(marking)` and `(sweeping)`, we don't want to merge those to avoid
    // having to do complex merge between previous stack and current stack.
    stack = prevStack.concat(stack[0])
  }
}
```

> image final GC output

The output is now a lot more readable.

@jlfwong I would like some guidance on my approach. Do you think we should keep GC sub frames or instead try to have stackprof return single GC frame?
