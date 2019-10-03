//@flow
import * as React from 'react';
import {Animated, Dimensions, View} from 'react-native';
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
  rlvDataProvider: typeof DataProvider,
  isDraggingRow: boolean,
  rlvCurrentDraggingRowIdx: number,
  rlvAtStartDraggingRowIdx: number,
  containerAbsoluteYTopOffset: number,
  containerHeight: number,
};

export class SortableList<T> extends React.PureComponent<Props<T>, RState> {
  state: RState = {
    rlvDataProvider: new DataProvider((r1, r2) => {
      return r1 !== r2;
    }, this.props.indexToKey).cloneWithRows(this.props.data),
    isDraggingRow: false,
    rlvCurrentDraggingRowIdx: -1,
    rlvAtStartDraggingRowIdx: -1,
    containerAbsoluteYTopOffset: 0,
    containerHeight: 0,
  };

  _rlvRef = React.createRef<RecyclerListView<any, any>>();
  _rlvScrollOffset: number = 0;
  _rlvDragTranslateY: number; // Used to determine when to scroll
  _rlvLayoutProvider = new LayoutProvider(
    index => {
      return 1;
    },
    (type, dim) => {
      dim.width = Dimensions.get('window').width;
      dim.height = this.props.rowHeight;
    },
  );
  // _rlvScrollingRequested = false;

  /* Theoretically it would be possible to use a single animated value. But instead we have to use two because with
   * Animated.View it's not currently possible to animated absolute layout values.
   *
   * These get used as follows:
   * 1) _rowAbsoluteY - has a listener attached to it when dragging starts and is used to trigger moving the dragged
   * row up and down in the RLV data provider and trigger scrolling.
   * 2) _translateY - is used to animate the movement of the dragged row in synchrony with the touch in the Animated.View
   * */
  _rowAbsoluteY = new Animated.Value(0);
  _translateY = new Animated.Value(0);

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

  componentWillUnmount() {
    this._rowAbsoluteY.removeAllListeners();
    this._translateY.removeAllListeners();
  }

  componentDidUpdate(prevProps: Props<T>) {
    if (prevProps.data !== this.props.data) {
      this.setState({
        rlvDataProvider: this.state.rlvDataProvider.cloneWithRows(
          this.props.data,
        ),
      });
    }
  }
  onLayoutStoreLayoutInfo = (e: ViewLayoutEvent) => {
    console.debug(' Handling layout e = ', e.nativeEvent);
    this.setState({
      containerAbsoluteYTopOffset: e.nativeEvent.layout.y,
      containerHeight: e.nativeEvent.layout.height,
    });
  };

  _rlvOnScrollStoreOffsetInfo = (
    rawEvent: ScrollEvent,
    offsetX: number,
    offsetY: number,
  ) => {
    this._rlvScrollOffset = offsetY;
  };

  _rlvTriggerScroll = (scrollAmountY: number) => {
    if (this.state.isDraggingRow === false) {
      // Cope with being cancelled on callback
      // console.debug('scrolling in progress, not calling again');
      return;
    }
    // console.debug('scrolling requested by amount ', scrollAmountY);

    if (this._rlvRef.current === null) {
      console.debug('moveList, no this.list.current, not doing anything');
      return;
    }

    // Don't bother scrolling if we are a the top already
    if (this._rlvScrollOffset + scrollAmountY <= 0) {
      console.debug('BOing');
      return;
    }

    // this._rlvScrollingRequested = true;
    this._rlvRef.current.scrollToOffset(
      // this._scrollOffset + amount,
      0,
      this._rlvScrollOffset + scrollAmountY,
      false,
    );

    requestAnimationFrame(() => {
      this._rlvTriggerScroll(scrollAmountY);
      // this._rlvScrollingRequested = false;
    });
  };

  _rlvGetIndexFromY = (absoluteY: number): number => {
    return Math.min(
      this.state.rlvDataProvider.getSize() - 1,
      Math.max(
        0,
        Math.floor(
          (absoluteY +
            this._rlvScrollOffset -
            this.state.containerAbsoluteYTopOffset) /
            this.props.rowHeight,
        ),
      ),
    );
  };

  _rlvRowRender = (type, data, index) => {
    //
    const dragHandleRender = () => {
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

    // Render the row if it's not being dragged, else render a filler placeholder
    return this.props.renderRow(
      data,
      index,
      this.state.rlvCurrentDraggingRowIdx === index ? 'placeholder' : 'normal',
      dragHandleRender(),
    );
  };

  _panGestureOnStateChange = event => {
    switch (event.nativeEvent.state) {
      case State.BEGAN:
        console.debug(
          '============== Gesture BEGAN =================================',
        );
        const rlvAtGestureStartIdx = this._rlvGetIndexFromY(
          event.nativeEvent.absoluteY,
        );
        const draggingRowOffset =
          rlvAtGestureStartIdx * this.props.rowHeight - this._rlvScrollOffset;

        console.debug('scrollOffset = ', this._rlvScrollOffset);
        this._translateY.setOffset(draggingRowOffset);

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
        console.debug(
          '==================== Gesture ACTIVE =================================',
        );

        // this._translateY.addListener(
        //   ({value}) => (this._rlvDragTranslateY = value),
        // );
        this._rowAbsoluteY.addListener(({value}) =>
          this._panGestureRowMovingListener(value),
        );
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
        // Stop any more panGestureUpdates
        this._rowAbsoluteY.removeAllListeners();
        this._translateY.removeAllListeners();
        // this._rlvScrollingRequested = false;
        this.setState({isDraggingRow: false});

        // Take what we need to update our onSort callback
        const rlvAtStartOfGestureIdx = this.state.rlvAtStartDraggingRowIdx;
        const rlvAtEndOfGestureIdx = this.state.rlvCurrentDraggingRowIdx;
        const rlvCurrentData = this.state.rlvDataProvider.getAllData();

        // Reset state and internal properties
        this.setState({
          rlvCurrentDraggingRowIdx: -1,
          rlvAtStartDraggingRowIdx: -1,
        });
        this._translateY.setOffset(0);
        this._rlvDragTranslateY = 0;

        // Trigger updating of external data iff necessary depending on if moving up or down in list
        if (rlvAtStartOfGestureIdx > rlvAtEndOfGestureIdx) {
          // Row moved up the list
          this.props.onSort(rlvAtStartOfGestureIdx, rlvAtEndOfGestureIdx);
        } else if (rlvAtStartOfGestureIdx < rlvAtEndOfGestureIdx) {
          // Row moved down in the list
          const lastIndex = rlvCurrentData.length - 1;
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

  _panGestureRowMovingListener = (absoluteY: number) => {
    // Discard anything that may be in the  queue after we've finished dragging
    if (this.state.isDraggingRow === false) {
      return;
    }

    /*
     * First up, have we dragged the row sufficiently towards the Bottom or Top of the screen that we should
     * move the view port on RLV Up or Down on the underlying data list
     */

    const minDragForOnset = 5;
    const scrollOnset = this.props.rowHeight;
    const scrollAmount = 20;

    const containerAbsoluteYBottomOffset =
      this.state.containerAbsoluteYTopOffset + this.state.containerHeight;

    if (
      absoluteY >
      containerAbsoluteYBottomOffset - scrollOnset //&&
      // this._rlvDragTranslateY > minDragForOnset
    ) {
      // Dragged row towards bottom of screen
      this._rlvTriggerScroll(scrollAmount); // mv view on list down
    } else if (
      absoluteY <
      this.state.containerAbsoluteYTopOffset + scrollOnset //&&
      //this._rlvDragTranslateY < -minDragForOnset
    ) {
      // ... towards top of screen
      this._rlvTriggerScroll(-scrollAmount); // mv view on list up
    }

    /*
     * Every time the dragged row moves over its immediate (above or below) neighbouring row update:
     * 1) The underlying data list order.
     * 2) Our references to what is being dragged in that list.
     */
    const draggedRowOverListIdx = this._rlvGetIndexFromY(absoluteY);

    if (draggedRowOverListIdx !== this.state.rlvCurrentDraggingRowIdx) {
      this.setState({
        rlvDataProvider: this.state.rlvDataProvider.cloneWithRows(
          immutableMove(
            this.state.rlvDataProvider.getAllData(),
            this.state.rlvCurrentDraggingRowIdx,
            draggedRowOverListIdx,
          ),
        ),
        rlvCurrentDraggingRowIdx: draggedRowOverListIdx,
      });
    }
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
      <View style={{flex: 1}} onLayout={this.onLayoutStoreLayoutInfo}>
        <Animated.View
          style={{
            position: 'absolute',
            transform: [{translateY: this._translateY}],
            zIndex: 200,
          }}>
          {this.state.isDraggingRow &&
            this.props.renderRow(
              this.props.data[this.state.rlvAtStartDraggingRowIdx], // NB: original data, as current rlv data will be updated
              this.state.rlvAtStartDraggingRowIdx,
              'dragging',
              this.props.renderDragHandle(), // No need wrap PanGestureHandler around as we actually drag what's in RLV and not this.
            ) // Or show nothing ....
          }
        </Animated.View>
        {this.props.data.length < 1 ? null : (
          <RecyclerListView
            key={this.props.rlvKludgeKey}
            ref={this._rlvRef}
            // style={{flex: 1, borderColor: 'red', borderWidth: 1}}
            onScroll={this._rlvOnScrollStoreOffsetInfo}
            layoutProvider={this._rlvLayoutProvider}
            dataProvider={this.state.rlvDataProvider}
            rowRenderer={this._rlvRowRender}
            extendedState={{dragging: true}}
            // disableRecycling={true}
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
