// @flow

import type {
  TextStyle,
  ViewStyle,
} from 'react-native/Libraries/StyleSheet/StyleSheet';

import {
  heightPercentageToDP,
  widthPercentageToDP,
} from 'react-native-responsive-screen';



export const CHARS_ITEM_DESCRIPTIONS_MAX = 90;

export const COLOUR_PRIMARY = 'red';

// From https://learnui.design/blog/ios-font-size-guidelines.html#iphone
const mediumWeight = '600';
const heavyWeight = '700';
const lightWeight = '100';

export const textStylePageTitle: TextStyle = {
  fontSize: 17,
  fontWeight: mediumWeight,
};
export const textStylePageTitleHome: TextStyle = {
  fontSize: 34,
  fontWeight: heavyWeight,
};

export const textStylePageSubTitle: TextStyle = {
  fontSize: 15,
  fontWeight: mediumWeight,
};

export const textStyleParagraph: TextStyle = {
  fontSize: 17,
};

export const textStyleLink: TextStyle = {
  fontSize: 17,
};
export const textStyleSecondary: TextStyle = {
  fontSize: 15,
  fontWeight: lightWeight,
};
export const textStyleSegmentedButton: TextStyle = {
  fontSize: 13,
};
export const textStyleCaption: TextStyle = {
  fontSize: 13,
};
export const textStyleButton: TextStyle = {
  fontSize: 17,
  color: COLOUR_PRIMARY,
};
export const buttonStyleDefault: TextStyle = {
  fontSize: 17,
  fontWeight: mediumWeight,
  color: COLOUR_PRIMARY,
};

export const textStyleInput: TextStyle = {
  fontSize: 17,
};
export const textStyleActionBar: TextStyle = {
  fontSize: 10,
};

export const textStyleListItemTitle: TextStyle = {
  fontSize: 17,
  fontWeight: mediumWeight,
};
export const textStylelistItemSubTitle: TextStyle = {
  fontSize: 15,
  fontWeight: mediumWeight,
};
export const textStyleListItemDescription: TextStyle = {
  fontSize: 15,
  fontWeight: lightWeight,
};

/*
 * App view styles
 * */

export const viewStyleScreenContainer: ViewStyle = {
  height: '100%',
  flex: 1,
};

export const viewStyleScreenKbdAvoiderContainer: ViewStyle = {
  maxHeight: '95%',
  flex: 1,
};

export const viewStylePanelContainer: ViewStyle = {
  paddingVertical: heightPercentageToDP(0.5),
  paddingHorizontal: widthPercentageToDP(1),
  borderWidth: 2,
};

export const viewStyleTextInput: ViewStyle = {
  borderRadius: heightPercentageToDP(1),
  paddingVertical: heightPercentageToDP(1),
  paddingHorizontal: widthPercentageToDP(1),
};

export const viewStyleTextShow: ViewStyle = {
  borderRadius: heightPercentageToDP(1),
  paddingVertical: heightPercentageToDP(1),
  paddingHorizontal: widthPercentageToDP(1),
};

export const viewStylePanelRow: ViewStyle = {
  paddingVertical: heightPercentageToDP(0.25),
  paddingHorizontal: widthPercentageToDP(1),
};
