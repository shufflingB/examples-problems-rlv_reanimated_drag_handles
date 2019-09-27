//@flow
import * as React from 'react';
import {Dimensions, View} from 'react-native';
import {DataProvider, LayoutProvider, RecyclerListView} from 'recyclerlistview';

import Animated from 'react-native-reanimated';
import {PanGestureHandler, State} from 'react-native-gesture-handler';
import type {ScrollEvent} from 'react-native/Libraries/Types/CoreEventTypes';

const {cond, eq, add, call, Value, event, or, debug} = Animated;

interface LayoutRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutChangeEvent {
  nativeEvent: {
    layout: LayoutRectangle,
  };
}

function immutableMove(arr, from, to) {
  return arr.reduce((prev, current, idx, self) => {
    if (from === to) {
      prev.push(current);
    }
    if (idx === from) {
      return prev;
    }
    if (from < to) {
      prev.push(current);
    }
    if (idx === to) {
      prev.push(self[from]);
    }
    if (from > to) {
      prev.push(current);
    }
    return prev;
  }, []);
}

type RState = {
  rowsDataProvider: typeof DataProvider,
  isDraggingRow: boolean,
  draggingRowIdx: number,
};

export class SortableList<T> extends React.PureComponent<Props<T>, RState> {
  // Hold a reference to the list so that we can trigger updates on it for scrolling.
  recylerListViewRef = React.createRef<RecyclerListView<any, any>>();
  _layoutProvider: typeof LayoutProvider;
  rowCenterY: Animated.Node<number>;
  absoluteY = new Value(0);
  gestureState = new Value(-1);
  onGestureEvent: any;
  halfRowHeightValue: Animated.Value<number>;

  /*The next two indices hold the position for the row that is currently being dragged.
   * - The first one (origIdx) is the location in the list as it was originally passed to RLV.
   * - Dragging is moving the row up or down in the list one place at a time. Each time it moves the list is re-rendered
   *   so that the placeholder for the dragged item moves accordingly in the list below.
   *   currIdx is the idx in that currently rendered list
   * */

  origIdx = -1; // index of row being currently dragged in the original list.
  currIdx = -1; // index of the row being currently dragged in the _currently_ _rendered_ list
  scrollOffset = 0;
  flatlistHeight = 0;
  topOffset = 0;
  isScrolling = false;

  constructor(props: Props<T>) {
    super(props);

    this.halfRowHeightValue = new Value(-props.rowHeight / 2);

    const {width} = Dimensions.get('window');

    this.onGestureEvent = event(
      [
        {
          nativeEvent: {
            absoluteY: this.absoluteY,
            state: this.gestureState,
          },
        },
      ],
      {useNativeDriver: true},
    );

    this.rowCenterY = add(this.absoluteY, this.halfRowHeightValue);

    this._layoutProvider = new LayoutProvider(
      index => {
        return 1;
      },
      (type, dim) => {
        dim.width = width;
        dim.height = props.rowHeight;
      },
    );

    const dataProvider = new DataProvider((r1, r2) => {
      return r1 !== r2;
    }, props.indexToKey);

    this.state = {
      rowsDataProvider: dataProvider.cloneWithRows(props.data),
      isDraggingRow: false,
      draggingRowIdx: -1,
    };
  }

  componentDidUpdate(prevProps: Props<T>) {
    if (prevProps.data !== this.props.data) {
      this.setState({
        rowsDataProvider: this.state.rowsDataProvider.cloneWithRows(
          this.props.data,
        ),
      });
    }
  }

  handleScroll = (rawEvent: ScrollEvent, offsetX: number, offsetY: number) => {
    this.scrollOffset = offsetY;
  };

  handleLayout = (e: LayoutChangeEvent) => {
    this.flatlistHeight = e.nativeEvent.layout.height;

    this.topOffset = e.nativeEvent.layout.y;
  };

  // Converts an absolute y value into the index in the array
  yToIndex = (y: number) =>
    Math.min(
      this.state.rowsDataProvider.getSize() - 1,
      Math.max(
        0,
        Math.floor(
          (y + this.scrollOffset - this.topOffset) / this.props.rowHeight,
        ),
      ),
    );

  recyclerListComponentScroll = (scrollAmountY: number) => {
    if (!this.isScrolling) {
      // Cope with being cancelled on callback
      console.debug(
        'moveList, !this.scrolling (not scrolling, not doing anything',
      );
      return;
    }

    if (this.recylerListViewRef.current === null) {
      console.debug('moveList, no this.list.current, not doing anything');
      return;
    }

    this.recylerListViewRef.current.scrollToOffset(
      // this.scrollOffset + amount,
      0,
      this.scrollOffset + scrollAmountY,
      false,
    );
    requestAnimationFrame(() => {
      this.recyclerListComponentScroll(scrollAmountY);
    });
  };

  animatedCodeReset = () => {
    const newData = this.state.rowsDataProvider.getAllData();
    this.setState({
      rowsDataProvider: this.state.rowsDataProvider.cloneWithRows(newData),
      isDraggingRow: false,
      draggingRowIdx: -1,
    });
    // Trigger updating of external list iff necessary depending on if moving up or down in list
    if (this.origIdx > this.currIdx) {
      // Row moved up the list
      this.props.onSort(this.origIdx, this.currIdx);
    } else if (this.origIdx < this.currIdx) {
      // Row moved down in the list
      const lastIndex = newData.length - 1;
      this.currIdx + 1 > lastIndex
        ? this.props.onSort(this.origIdx, null)
        : this.props.onSort(this.origIdx, this.currIdx + 1);
    }
    this.isScrolling = false;
    this.currIdx = -1;
    this.origIdx = -1;
  };

  animatedCodeRowDragStart = ([y]: {y: number}) => {
    /*Determine the index of the row that is being dragged and store it so that we
     * know what row is being moved and can:
     *   1) Determine what row to show animated above the non-moving rows of the list.
     *   2) Know where to place a blank placeholder row where the one we are dragging was originally from.
     *   3) Ultimately figure out how to update the array elements that are being dragged around
     * */

    this.currIdx = this.yToIndex(y);
    this.origIdx = this.currIdx;
    this.setState({isDraggingRow: true, draggingRowIdx: this.currIdx});
  };

  animatedCodeRowMoving = ([y]: {y: number}) => {
    /*
     * First up, have we dragged the row sufficiently towards the Bottom or Top of the screen that we should
     * moving the view port on the list by scrolling Down or Up.
     */

    const scrollOnset = 100;

    if (y > this.flatlistHeight - scrollOnset) {
      // Dragged row towards bottom of screen
      if (!this.isScrolling) {
        this.isScrolling = true;
        this.recyclerListComponentScroll(20); // mv view on list down
      }
    } else if (y < scrollOnset) {
      // ... towards top of screen
      if (!this.isScrolling) {
        this.isScrolling = true;
        this.recyclerListComponentScroll(-20); // mv view on list up
      }
    } else {
      this.isScrolling = false;
    }

    /*
     * Every time the dragged row moves over its immediate (above or below) neighbouring row update:
     * 1) The underlying data list order.
     * 2) Our references to what is being dragged in that list.
     */
    const draggedRowOverListIdx = this.yToIndex(y);

    if (draggedRowOverListIdx !== this.currIdx) {
      this.setState({
        rowsDataProvider: this.state.rowsDataProvider.cloneWithRows(
          immutableMove(
            this.state.rowsDataProvider.getAllData(),
            this.currIdx,
            draggedRowOverListIdx,
          ),
        ),
        draggingRowIdx: draggedRowOverListIdx,
      });
      this.currIdx = draggedRowOverListIdx;
    }
  };

  _rowRenderer = (type, data, index) => {
    // Render the row if it's not being dragged, else render a filler placeholder
    return this.props.renderRow(
      data,
      index,
      this.state.draggingRowIdx === index ? 'placeholder' : 'normal',
      <>
        <PanGestureHandler
          minPointers={1}
          maxPointers={1}
          onGestureEvent={this.onGestureEvent}
          onHandlerStateChange={this.onGestureEvent}>
          <Animated.View>
            <View>{this.props.renderDragHandle()}</View>
          </Animated.View>
        </PanGestureHandler>
      </>,
    );
  };

  render() {
    /*
    1) If we are dragging then we render:

       i) The list but with the row being dragged as the opaque background colour as it is moved in the list in
        response to the drag i.e. the row moves in +1 increments up or down the list and the blank
        placeholder indicates where it in the list it would be if the drag is released.

       ii) The row that is being dragged in its own view ontop of the list, i.e. absolute and
       with a zIndex > than the list behind it.

       The two actions when combined give the impression of the row being picked up and the list shuffling
       around it as the row is dragged up or down.

     2) Else, if we are not dragging then render list as normal with nothing hovering over the top.
    */

    return (
      <>
        <Animated.Code>
          {() =>
            cond(
              or(
                eq(this.gestureState, State.END),
                eq(this.gestureState, State.CANCELLED),
                eq(this.gestureState, State.FAILED),
                eq(this.gestureState, State.UNDETERMINED),
              ),
              call([], this.animatedCodeReset),
            )
          }
        </Animated.Code>

        {/*<Animated.Code>*/}
        {/*  {() => debug("Bollocks, gesture state = ", this.gestureState)}*/}
        {/*</Animated.Code>*/}

        <Animated.Code>
          {() =>
            cond(
              eq(this.gestureState, State.BEGAN),
              call([this.absoluteY], this.animatedCodeRowDragStart),
            )
          }
        </Animated.Code>

        <Animated.Code>
          {() =>
            cond(
              eq(this.gestureState, State.ACTIVE),
              call([this.absoluteY], this.animatedCodeRowMoving),
            )
          }
        </Animated.Code>

        {this.state.isDraggingRow ? (
          <Animated.View
            style={{
              top: this.rowCenterY,
              position: 'absolute',
              width: '100%',
              zIndex: 99,
              elevation: 99,
            }}>
            {this.props.renderRow(
              this.state.rowsDataProvider.getDataForIndex(
                this.state.draggingRowIdx,
              ),
              this.state.draggingRowIdx,
              'dragging',
              this.props.renderDragHandle(),
            )}
          </Animated.View>
        ) : null}

        {this.props.data.length < 1 ? null : (
          /* TODO: Would like to remove length based key from RLV but without it removing rows from the data causes the
           * remaining drag handles to cease working because the animated code gets unmounted and stops working. Having
           * the length based key causes RLV to fully re-render and re-mount animated code, but also causes annoying
           * flicker.
           *
           * Unsuccessful things tried to fix:
           * - Animated.code blocks in with the drag handles to see if it reference counts better.
           * - RLV's disable recycling argument to if it's RLV recycling of Views that's breaking things.
           * - Keying the rows (second argument to RLV's Dataprovider constructor) with a unique key based on the row's
           *   id and not just its idx.
           * - Removing swipeable sub-component to see if it was the two gesture responders interfering with each other.
           * - Using getDerivedState to update RLV's data provider instead of componentDidUpdate
           *
           * Workaround key rlvKeyKludge only changes when the length of what's being rendered gets shorter. Which
           * at least stops the flicker when the length grows.
           * */
          <RecyclerListView
            key={this.props.rlvKludgeKey}
            ref={this.recylerListViewRef}
            style={{flex: 1}}
            onScroll={this.handleScroll}
            onLayout={nativeEvent => this.handleLayout(nativeEvent)}
            layoutProvider={this._layoutProvider}
            dataProvider={this.state.rowsDataProvider}
            rowRenderer={this._rowRenderer}
            extendedState={{dragging: true}}
          />
        )}
      </>
    );
  }
}

type Props<T> = {
  rlvKludgeKey: string,
  rowHeight: number,
  data: Array<T>,
  indexToKey: (index: number) => string,
  renderRow: (
    dataItem: T,
    dataItemIndex: number,
    dataItemState: 'normal' | 'dragging' | 'placeholder',
    dataItemDragHandle: React.Node,
  ) => React.Node | null,
  renderDragHandle: () => React.Node,
  onSort: (movedIdx: number, inFrontOfIdx: number | null) => void,
};
