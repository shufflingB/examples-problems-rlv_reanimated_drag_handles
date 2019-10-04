## Intro

This branch contains a version of the todo demo app that does not suffer from the 'disappearing drag handles when rows are deleted' that is present in original demo on 'master'

To get it to work and have the native driver enabled (useNative = true) the important changes were:

1. Switching out the [reanimated](https://github.com/kmagiera/react-native-reanimated) library for React Native's standard Animation api.
2. Refactoring so that the Animated.View used to animate the dragged row, is always rendered, even when it does not have a dragged row to render (the alternative, mounting, unmounting and remounting depending on drag status doesn't work with useNative true )

## Installation and running

### ios

Usual assumptions about working node, yarn, xcode, simulators etc being installed. Then

0. `cd checkout_location`
1. `yarn install`
1. `react-native link react-native-gesture-handler` - shouldn't need it but it does.
1. `cd ios && pod install && cd ..`
1. `yarn ios`

### Android

Android's not a platform that's targeted at the moment, it should probably work but it's untested.

## Notes
