// @flow
import * as React from 'react';
import {useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {
  textStyleInput,
  textStylePageSubTitle,
  textStyleSecondary,
  viewStylePanelRow,
  viewStyleTextInput,
  CHARS_ITEM_DESCRIPTIONS_MAX,
} from '../appConstants';

import type {
  TextStyle,
  ViewStyle,
} from 'react-native/Libraries/StyleSheet/StyleSheet';
import {heightPercentageToDP} from 'react-native-responsive-screen';

export default (props: Props): React.Node => {
  // Create our Local State
  const [inputFocused, inputFocusedSet] = useState<boolean>(false);

  /*
   * NB: As of 2019/06 afaik the TextInput component does not provide any other way to disable the Return/Go key programmatically
   * beyond "a has anything at all been entered" that can be enabled via the enablesReturnKeyAutomatically property. See
   * https://stackoverflow.com/questions/34560783/disable-return-key-in-react-native-textinput?rq=1 . Consequently, this
   * means that it makes more sense to do more most input validation, such as minimum length, number of words etc
   * later on in processing, e.g.
   *  a) Chuck up a modal on submission in the calling component asking user if they are sure.
   *  b) When performing scheduled planning/triage session, highlight as being Items where more data might be needed.
   * */
  return (
    <View style={props.styleContainer}>
      <TextInput
        style={
          inputFocused
            ? styles.textDescriptionInputFocused
            : styles.textDescriptionInput
        }
        multiline={true}
        maxLength={CHARS_ITEM_DESCRIPTIONS_MAX + 1} // Workaround for onKeyChange bug, +1 is to allow for the return keypress
        enablesReturnKeyAutomatically // See block comment above about TextInput limitations.
        placeholder={props.placeHolder}
        autoFocus={true}
        returnKeyType={'go'}
        onChangeText={text => props.onChangeText(text)}
        onFocus={() => inputFocusedSet(true)}
        value={props.itemDescription}
      />
      <View style={styles.viewCharCountRow}>
        <Text>
          <Text style={styles.textCharCount}>Characters left:</Text>
          <Text style={[styles.textCharCount, {width: '10%'}]}>
            {CHARS_ITEM_DESCRIPTIONS_MAX -
              (props.itemDescription != null
                ? props.itemDescription.length
                : 0)}
          </Text>
        </Text>
      </View>
    </View>
  );
};

const viewPanelContainer: ViewStyle = {
  borderColor: 'lightgrey',
  borderTopWidth: 1,
  // height: "25%"
};

const viewCharCountRow: ViewStyle = {
  ...viewStylePanelRow,
  flexDirection: 'row',
  justifyContent: 'flex-end',
};

const textInputLabel: TextStyle = {
  ...textStylePageSubTitle,
  ...viewStylePanelRow,
};

const textDescriptionInput: TextStyle = {
  ...textStyleInput,
  ...viewStyleTextInput,
  borderWidth: 0.25,
  width: '100%',
  minHeight: heightPercentageToDP(12),
  // height: "60%"
};

const textDescriptionInputFocused: TextStyle = {
  ...textDescriptionInput,
};

const textCharCount: TextStyle = {
  ...textStyleSecondary,
  textAlign: 'right',
};

const styles = StyleSheet.create({
  viewPanelContainer: viewPanelContainer,
  textInputLabel: textInputLabel,
  textDescriptionInput: textDescriptionInput,
  textDescriptionInputFocused: textDescriptionInputFocused,
  viewCharCountRow: viewCharCountRow,
  textCharCount: textCharCount,
});

type Props = {
  placeHolder: string,
  itemDescription: string | null,
  onChangeText: string => void,
  styleContainer: ViewStyle,
};
