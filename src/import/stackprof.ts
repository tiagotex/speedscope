// https://github.com/tmm1/stackprof

import {Profile, FrameInfo, StackListProfileBuilder} from '../lib/profile'
import {TimeFormatter} from '../lib/value-formatters'

interface StackprofFrame {
  name: string
  file?: string
  line?: number
}

export interface StackprofProfile {
  frames: {[number: string]: StackprofFrame}
  mode: string
  raw: number[]
  raw_timestamp_deltas: number[]
  samples: number
}

export function importFromStackprof(stackprofProfile: StackprofProfile): Profile {
  const {frames, mode, raw, raw_timestamp_deltas, samples} = stackprofProfile
  const objectMode = mode == 'object'

  const size = objectMode ? samples : stackprofProfile.raw_timestamp_deltas.reduce((a, b) => a + b, 0)
  const profile = new StackListProfileBuilder(size)

  let sampleIndex = 0

  let prevStack: FrameInfo[] = []

  for (let i = 0; i < raw.length; ) {
    const stackHeight = raw[i++]

    let stack: FrameInfo[] = []
    for (let j = 0; j < stackHeight; j++) {
      const id = raw[i++]
      stack.push({
        key: id,
        ...frames[id],
      })
    }

    // // Concatenate single garbage collection frame to previous stack instead of showing it as root stack
    // if (stack[0].name === '(garbage collection)') {
    //   // When the last previous stack frame is garbage collection then we can reuse that stack
    //   if (prevStack[prevStack.length - 1].name === '(garbage collection)') {
    //     stack = prevStack
    //   } else {
    //     // We only want to merge the garbage collection frame with the previous stack.
    //     // Stackprof can return sub frames like `(marking)` and `(sweeping)`, we don't want to merge those to avoid
    //     //having to do complex merge between previous stack and current stack.
    //     stack = prevStack.concat(stack[0])
    //   }
    // }

    // // Check for main thread io wait
    // if (stack[0].name === '<main>' && stack[stack.length - 1].name === 'Puma::Single#run') {
    //   stack = prevStack.concat({...stack[0], name: "(io wait)", file: undefined, line: undefined})
    // }

    // We can update this version to keep track of previousStackGCIndex and previousStackIOWaitIndex
    // This way we can always know where it was to start the merge


    const nSamples = raw[i++]

    if (objectMode) {
      profile.appendSampleWithWeight(stack, nSamples)
    } else {
      let sampleDuration = 0
      for (let j = 0; j < nSamples; j++) {
        sampleDuration += raw_timestamp_deltas[sampleIndex++]
      }

      profile.appendSampleWithWeight(stack, sampleDuration)
    }

    prevStack = stack
  }

  if (!objectMode) {
    profile.setValueFormatter(new TimeFormatter('microseconds'))
  }

  return profile.build()
}
