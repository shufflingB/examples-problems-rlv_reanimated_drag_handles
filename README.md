## Intro

This is a ios demo app to illustrate a problem that occurs when the [reanimated](https://github.com/kmagiera/react-native-reanimated) library is used in conjunction with
the [recyclelistview](https://github.com/Flipkart/recyclerlistview) (RLV) component to implement drag re-orderable lists.

All seems to be working correctly up until a row is deleted, whereupon the remaining rows stop being draggable. The only
way I've found to stop this is change the key attribute to RLV, whereupon the forced RLV re-render causes reanimated's Animated code to be mounted again.

## Installation and running

### ios

Usual assumptions about working node, yarn, xcode, simulators etc being installed. Then

0. `cd checkout_location`
1. `yarn install`
1. `react-native link react-native-gesture-handler` - shouldn't need it but it does.
1. `cd ios && pod install && cd ..`
1. `yarn ios`

Using the app to play around with the problem should be straight forward, with more details embedded in it and the code base.

### Android

Android's not a platform that's targeted at the moment, it should probably work but it's untested.

## Notes
