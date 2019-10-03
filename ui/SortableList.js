//@flow
import * as React from 'react';
import {Dimensions, View, Animated} from 'react-native';
import {DataProvider, LayoutProvider, RecyclerListView} from 'recyclerlistview';

import {PanGestureHandler, State} from 'react-native-gesture-handler';
import type {ViewLayoutEvent} from 'react-native/Libraries/Components/View/ViewPropTypes';
import type {ScrollEvent} from 'react-native/Libraries/Types/CoreEventTypes';

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
  rlvCurrentDraggingRowIdx: number,
  rlvAtStartDraggingRowIdx: number,
  rlvAbsoluteYTopOffset: number,
  rlvFlatListHeight: number,
  rlvScrollOffset: number,
};

export class SortableList<T> extends React.PureComponent<Props<T>, RState> {
  state: RState = {
    rowsDataProvider: new DataProvider((r1, r2) => {
      return r1 !== r2;
    }, this.props.indexToKey).cloneWithRows(this.props.data),
    isDraggingRow: false,
    rlvCurrentDraggingRowIdx: -1,
    rlvAtStartDraggingRowIdx: -1,
    rlvAbsoluteYTopOffset: 0,
    rlvFlatListHeight: 0,
    rlvScrollOffset: 0,
  };

  _rlvRef = React.createRef<RecyclerListView<any, any>>();
  _rlvLayoutProvider = new LayoutProvider(
    index => {
      return 1;
    },
    (type, dim) => {
      dim.width = Dimensions.get('window').width;
      dim.height = this.props.rowHeight;
    },
  );
  _rlvScrollingRequested = false;

  _rowAbsoluteY = new Animated.Value(0);
  _translateY = new Animated.Value(0);
  _halfRowHeightValue = new Animated.Value(-this.props.rowHeight / 2);
  _panGestureOnEventUpdate = Animated.event(
    [
      {
        nativeEvent: {
          translationY: this._translateY,
          absoluteY: this._rowAbsoluteY,
        },
      },
    ],
    {useNativeDriver: true},
  );

  componentDidMount() {
    // this._rowAbsoluteY.addListener(y => this.acRowMoving(y));
    // this._rowAbsoluteY.addListener(y => console.debug('absoluteY = ', y));
  }

  componentWillUnmount() {
    this._rowAbsoluteY.removeAllListeners();
  }

  componentDidUpdate(prevProps: Props<T>) {
    console.debug('componentDidUpdate ===========================');
    if (prevProps.data !== this.props.data) {
      console.debug('update rowsData provider');
      this.setState({
        rowsDataProvider: this.state.rowsDataProvider.cloneWithRows(
          this.props.data,
        ),
      });
    }
  }

  rlvOnScrollStoreOffsetInfo = (
    rawEvent: ScrollEvent,
    offsetX: number,
    offsetY: number,
  ) => {
    this.setState({rlvScrollOffset: offsetY});
  };

  rlvOnLayoutStoreLayoutInfo = (e: ViewLayoutEvent) => {
    console.debug(' Handling layout e = ', e.nativeEvent);
    this.setState({
      rlvAbsoluteYTopOffset: e.nativeEvent.layout.y,
      rlvFlatListHeight: e.nativeEvent.layout.height,
    });
  };

  rlvTriggerScroll = (scrollAmountY: number) => {
    if (!this._rlvScrollingRequested) {
      // Cope with being cancelled on callback
      console.debug(
        'moveList, !this.scrolling (not scrolling, not doing anything',
      );
      return;
    }

    if (this._rlvRef.current === null) {
      console.debug('moveList, no this.list.current, not doing anything');
      return;
    }

    this._rlvRef.current.scrollToOffset(
      // this._scrollOffset + amount,
      0,
      this.state.rlvScrollOffset + scrollAmountY,
      false,
    );
    requestAnimationFrame(() => {
      this.rlvTriggerScroll(scrollAmountY);
    });
  };

  // Converts an absolute y value into the index in the array
  yToRlvIndex = (absoluteY: number): number => {
    const idx = Math.min(
      this.state.rowsDataProvider.getSize() - 1,
      Math.max(
        0,
        Math.floor(
          (absoluteY +
            this.state.rlvScrollOffset -
            this.state.rlvAbsoluteYTopOffset) /
            this.props.rowHeight,
        ),
      ),
    );
    console.debug(
      'y = ',
      absoluteY,
      ' scrollOffeset =',
      this.state.rlvScrollOffset,
      ' rlvAbsoluteYTopOffset = ',
      this.state.rlvAbsoluteYTopOffset,
      ' idx = ',
      idx,
    );

    return idx;
  };

  acRowMoving = (y: number) => {
    /*
     * First up, have we dragged the row sufficiently towards the Bottom or Top of the screen that we should
     * moving the view port on the list by scrolling Down or Up.
     */
    console.debug('acRowMoving y', y);

    const scrollOnset = this.props.rowHeight / 2;

    if (y > this.state.rlvFlatListHeight - scrollOnset) {
      // Dragged row towards bottom of screen
      if (!this._rlvScrollingRequested) {
        this._rlvScrollingRequested = true;
        this.rlvTriggerScroll(this.props.rowHeight); // mv view on list down
      }
    } else if (y < scrollOnset) {
      // ... towards top of screen
      if (!this._rlvScrollingRequested) {
        this._rlvScrollingRequested = true;
        this.rlvTriggerScroll(-this.props.rowHeight); // mv view on list up
      }
    } else {
      this._rlvScrollingRequested = false;
    }

    /*
     * Every time the dragged row moves over its immediate (above or below) neighbouring row update:
     * 1) The underlying data list order.
     * 2) Our references to what is being dragged in that list.
     */
    const draggedRowOverListIdx = this.yToRlvIndex(y);
    console.debug('acRowMoving detected moving idx =', draggedRowOverListIdx);

    if (draggedRowOverListIdx !== this.state.rlvCurrentDraggingRowIdx) {
      console.debug(
        '==================== acRowMoving dragging over ============',
      );
      this.setState({
        rowsDataProvider: this.state.rowsDataProvider.cloneWithRows(
          immutableMove(
            this.state.rowsDataProvider.getAllData(),
            this.state.rlvCurrentDraggingRowIdx,
            draggedRowOverListIdx,
          ),
        ),
        rlvCurrentDraggingRowIdx: draggedRowOverListIdx,
      });
    }
  };

  _panGestureOnStateChange = event => {
    console.debug('event.nativeEvent === ', event.nativeEvent);
    switch (event.nativeEvent.state) {
      case State.BEGAN:
        console.debug(
          '============== Gesture BEGAN =================================',
        );
        const rlvAtGestureStartIdx = this.yToRlvIndex(
          event.nativeEvent.absoluteY,
        );
        const draggingRowOffset = rlvAtGestureStartIdx * this.props.rowHeight;
        console.debug('scrollOffset = ', this.state.rlvScrollOffset);
        this._translateY.setOffset(
          draggingRowOffset, // TODO: Figure out this offset arse we
          // draggingRowOffset - this.state.rlvScrollOffset,
        );

        console.debug(
          'acRowDragStart detected moving idx =',
          rlvAtGestureStartIdx,
        );
        this.setState({
          isDraggingRow: true,
          rlvCurrentDraggingRowIdx: rlvAtGestureStartIdx,
          rlvAtStartDraggingRowIdx: rlvAtGestureStartIdx,
        });

        break;

      case State.ACTIVE:
        this._rowAbsoluteY.addListener(({value}) => this.acRowMoving(value));
        break;

      case State.CANCELLED:
      //  Intentional fall through
      case State.FAILED:
      //  Intentional fall through
      case State.UNDETERMINED:
      //  Intentional fall through
      case State.END:
        console.debug(
          '==================== Gesture END =================================',
        );
        this._rowAbsoluteY.removeAllListeners();

        // Take what we need to update our onSort callback
        const rlvAtStartOfGestureIdx = this.state.rlvAtStartDraggingRowIdx;
        const rlvAtEndOfGestureIdx = this.state.rlvCurrentDraggingRowIdx;
        const newData = this.state.rowsDataProvider.getAllData();

        // Reset state and internal properties
        this.setState({
          isDraggingRow: false,
          rlvCurrentDraggingRowIdx: -1,
          rlvAtStartDraggingRowIdx: -1,
        });
        this._rlvScrollingRequested = false;
        // this._translateY.resetAnimation();
        this._translateY.setOffset(0);

        // Trigger updating of external data iff necessary depending on if moving up or down in list
        if (rlvAtStartOfGestureIdx > rlvAtEndOfGestureIdx) {
          // Row moved up the list
          this.props.onSort(rlvAtStartOfGestureIdx, rlvAtEndOfGestureIdx);
        } else if (rlvAtStartOfGestureIdx < rlvAtEndOfGestureIdx) {
          // Row moved down in the list
          const lastIndex = newData.length - 1;
          rlvAtEndOfGestureIdx + 1 > lastIndex
            ? this.props.onSort(rlvAtStartOfGestureIdx, null)
            : this.props.onSort(
                rlvAtStartOfGestureIdx,
                rlvAtEndOfGestureIdx + 1,
              );
        }

        break;

      default:
        console.debug(
          'Unexpected nativeEvent.state, got ',
          event.nativeEvent.state,
        );
    }
  };

  _dragHandleRender = () => {
    return (
      <PanGestureHandler
        minPointers={1}
        maxPointers={1}
        onGestureEvent={this._panGestureOnEventUpdate}
        onHandlerStateChange={this._panGestureOnStateChange}>
        <Animated.View>{this.props.renderDragHandle()}</Animated.View>
      </PanGestureHandler>
    );
  };

  _rlvRowRender = (type, data, index) => {
    // Render the row if it's not being dragged, else render a filler placeholder
    return this.props.renderRow(
      data,
      index,
      this.state.rlvCurrentDraggingRowIdx === index ? 'placeholder' : 'normal',
      this._dragHandleRender(),
    );
  };

  _draggingRowRender = (isDragging: boolean, draggingRowIdx: number) => {
    return (
      <Animated.View
        style={{
          position: 'absolute',
          transform: [{translateY: this._translateY}],
          // height: this.props.rowHeight,
          // width: '100%',
          zIndex: 200,
        }}>
        {isDragging &&
          this.props.renderRow(
            this.props.data[draggingRowIdx],
            draggingRowIdx,
            'dragging',
            this.props.renderDragHandle(), // No need wrap PanGestureHandler around
          )}
      </Animated.View>
    );
  };

  render() {
    /*
     * Render the Animated View over the top of the RLV. Then, when:
     *
     * - Not dragging,
     *   a) the Animated View is rendered with nothing in it (the alternative
     *   of not rendering the Animated View doesn't work when useNative is
     *   enabled (as of RN 0.61.1) when rows are removed or items in the list are updated)
     *   b) RLV is instructed to render all rows as normal.
     *
     * - Dragging
     *   a) Animated View is rendered with a row styles as dragging.
     *   b) RLV renders the row that is being dragged up or down the list styled
     *   as a placeholder.
     *
     */

    return (
      <View
        style={{flex: 1}}
        onLayout={this.rlvOnLayoutStoreLayoutInfo}
        // key={this.state.reRenderKey}
      >
        {this._draggingRowRender(
          this.state.isDraggingRow,
          this.state.rlvAtStartDraggingRowIdx,
        )}
        {this.props.data.length < 1 ? null : (
          <RecyclerListView
            key={this.props.rlvKludgeKey}
            ref={this._rlvRef}
            // style={{flex: 1, borderColor: 'red', borderWidth: 1}}
            onScroll={this.rlvOnScrollStoreOffsetInfo}
            layoutProvider={this._rlvLayoutProvider}
            dataProvider={this.state.rowsDataProvider}
            rowRenderer={this._rlvRowRender}
            extendedState={{dragging: true}}
            disableRecycling={true}
          />
        )}
      </View>
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
