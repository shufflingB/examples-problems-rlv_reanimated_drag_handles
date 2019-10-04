// @flow

import * as React from 'react';
import {SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {SortableList} from './SortableList';
import {widthPercentageToDP} from 'react-native-responsive-screen';
import {RectButton} from 'react-native-gesture-handler';
import type {
  TextStyle,
  ViewStyle,
} from 'react-native/Libraries/StyleSheet/StyleSheet';
import {CHARS_ITEM_DESCRIPTIONS_MAX} from '../appConstants';

import NewGoalPanel from './NewGoalPanel';
import type {goal_t} from '../App';

const rowHeight = 70;

type State = {
  textGoalDescription: string,
  rlvKeyKludge: 'tick' | 'toc',
};
export default class Main extends React.Component<Props, State> {
  state: State = {
    textGoalDescription: '',
    rlvKeyKludge: 'tick',
  };

  onChangeText(textNew: string) {
    // Workaround for onKeyChange bug(?). Namely
    // Detect Enter key press here as the onKeyChange method doesn't work
    // when there is no debugger attached to the simulator ( it triggers minutes
    // after the event)
    const textNewLength = textNew.length;
    if (textNewLength > 1) {
      // See if pressed Enter key
      const textNewLastChar = textNew[textNewLength - 1];
      if (textNewLastChar === '\n') {
        const newGoal = textNew.trim();
        this.props.addNewGoal(newGoal);
        this.setState({textGoalDescription: ''});
        return;
      }
    }

    if (textNewLength <= CHARS_ITEM_DESCRIPTIONS_MAX) {
      this.setState({textGoalDescription: textNew});
    }
  }

  render() {
    const {goals} = this.props;
    return (
      <SafeAreaView style={{flex: 1}}>
        <View style={styles.blurb}>
          <Text style={styles.paragraph}>
            Todo demo app illustrating drag handles with recyclerlistview
          </Text>
          <Text style={styles.paragraph}>
            Move the '@' drag handles to re-order the list. Click an 'X' to
            delete a list entry.
          </Text>
          <Text style={styles.paragraph}>Enter a new task and hit return.</Text>
        </View>
        <NewGoalPanel
          itemDescription={this.state.textGoalDescription}
          placeHolder={'Enter new task. Press return when done'}
          onChangeText={(description: string) => this.onChangeText(description)}
          styleContainer={styles.newGoal}
        />

        <SortableList
          rlvKludgeKey={this.state.rlvKeyKludge}
          data={goals}
          onSort={(idxMoved, idxMovedInFrontOf) =>
            this.props.mvGoal(
              goals[idxMoved].id,
              idxMovedInFrontOf === null ? null : goals[idxMovedInFrontOf].id,
            )
          }
          rowHeight={rowHeight}
          indexToKey={idx => {
            return idx.toString();
          }}
          renderDragHandle={() => <Text>@</Text>}
          renderRow={(
            dataItem,
            dataItemIdx,
            dataItemState,
            dataItemDragHandle,
          ) => {
            return (
              <View
                style={
                  dataItemState === 'normal'
                    ? styles.row
                    : dataItemState === 'placeholder'
                    ? styles.rowPlaceholderInList
                    : styles.rowBeingDragged
                }>
                <View style={styles.dragHandle}>{dataItemDragHandle}</View>
                <View style={styles.content}>
                  <Text numberOfLines={3} style={styles.taskText}>
                    {dataItem.task} {dataItemState}
                  </Text>
                </View>
                <RectButton
                  style={styles.deleteButton}
                  onPress={() => this.props.rmGoal(dataItem.id)}>
                  <Text>X</Text>
                </RectButton>
              </View>
            );
          }}
        />
      </SafeAreaView>
    );
  }
}

const vsNew: ViewStyle = {
  padding: 10,
  borderColor: 'lightgrey',
  borderTopWidth: 1,
  borderBottomWidth: 1,
};
const vsBlurb: ViewStyle = {
  ...vsNew,
};

const vsRow: ViewStyle = {
  height: rowHeight,
  flexDirection: 'row',
  flex: 1,
  justifyContent: 'space-around',
  opacity: 1,
  borderColor: 'lightgrey',
  borderTopWidth: 1,
  borderBottomWidth: 1,
  backgroundColor: 'white',
};

const vsRowPlaceholderInList: ViewStyle = {
  ...vsRow,
  opacity: 0, // Hide any text it contains so as not to conflict with what's being dragged.
};

const elevation = 10;
const vsRowBeingDragged: ViewStyle = {
  ...vsRow,
  shadowColor: 'black',
  shadowOffset: {width: 0, height: 0.5 * elevation},
  shadowOpacity: 0.3,
  shadowRadius: 0.8 * elevation,
  borderWidth: 1,
  borderColor: 'red',
  opacity: 1,
};

const vsDragHandle: ViewStyle = {
  width: widthPercentageToDP(10),
  justifyContent: 'center',
  alignContent: 'center',
  paddingLeft: 10,
  // borderColor: "green",
  // borderWidth: 2
};

const vsDeleteButton: ViewStyle = {
  width: widthPercentageToDP(10),
  justifyContent: 'center',
  alignContent: 'center',
  paddingLeft: 10,
  // borderColor: "green",
  // borderWidth: 2
};

const vsContent: ViewStyle = {
  height: '100%',
  width: widthPercentageToDP(85),
  padding: 10,
  // borderColor: "red",
  // borderWidth: 2
};

const txtTask: TextStyle = {
  color: '#999',
  backgroundColor: 'transparent',
};

const txtParagraph: TextStyle = {
  padding: 2,
};
const vsFixButton: ViewStyle = {
  backgroundColor: 'lightgreen',
  shadowColor: 'black',
  shadowOffset: {width: 0, height: 0.5 * elevation},
  shadowOpacity: 0.3,
  shadowRadius: 0.8 * elevation,
  padding: 10,
  borderRadius: 5,
};

const styles = StyleSheet.create({
  blurb: vsBlurb,
  paragraph: txtParagraph,
  newGoal: vsNew,
  taskText: txtTask,
  row: vsRow,
  rowPlaceholderInList: vsRowPlaceholderInList,
  rowBeingDragged: vsRowBeingDragged,
  dragHandle: vsDragHandle,
  deleteButton: vsDeleteButton,
  content: vsContent,
  fixButton: vsFixButton,
});

type Props = {
  goals: Array<goal_t>,
  mvGoal: (idMove: number, idMovedInFrontOf: number | null) => void,
  addNewGoal: string => void,
  rmGoal: (id: number) => void,
};
