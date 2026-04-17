import React from 'react';
import { connect } from 'react-redux';

import Chat from './constructorComponents/chat';
import AnimList from './features/animList';
import Constructor from './constructor';
import SkillsMenu from './features/skillsMenu';
import TestMenu from './features/testMenu';
import AdminDashboard from './features/adminDashboard';
import ServerList from './features/serverList';

const shouldForceLoggedInView = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('devUi') === '1' || window.localStorage.getItem('skymp.dev.loggedIn') === '1';
  } catch {
    return false;
  }
};

const getDevOverlayTargets = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('devOverlay') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const isBrowserDevUiMode = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('devUi') === '1';
  } catch {
    return false;
  }
};

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoggined: shouldForceLoggedInView(),
      isDevUiMode: isBrowserDevUiMode(),
      widgets: this.props.elem || null
    };
  }

  componentDidMount() {
    window.addEventListener('focus', this.onWindowFocus.bind(this));
    window.addEventListener('blur', this.onWindowFocus.bind(this));
    window.mp = {
      send: (type, data) => {
        try {
          window.skymp.send({
            type,
            data
          });
        } catch {
          console.log(type, data);
        }
      }
    };

    try {
      window.skymp.on('error', console.error);
      window.skymp.on('message', (action) => {
        window.storage.dispatch(action);
      });
    } catch { }

    window.isMoveWindow = false;
    window.addEventListener('mousemove', this.onMoveWindow);
    window.addEventListener('mouseup', this.onMouseUp);

    window.skyrimPlatform.widgets.addListener(this.handleWidgetUpdate.bind(this));

    if (shouldForceLoggedInView()) {
      window.localStorage.setItem('skymp.dev.loggedIn', '1');
      const overlayTargets = getDevOverlayTargets();
      setTimeout(() => {
        if (overlayTargets.includes('serverList')) {
          window.dispatchEvent(new Event('showServerList'));
        }
        if (overlayTargets.includes('admin')) {
          window.dispatchEvent(new Event('showAdminDashboard'));
        }
      }, 0);
    }
  }

  handleWidgetUpdate(newWidgets) {
    this.setState({
      ...this.state,
      widgets: newWidgets
    });
  }

  componentWillUnmount() {
    window.removeEventListener('focus', this.onWindowFocus.bind(this));
    window.removeEventListener('blur', this.onWindowFocus.bind(this));
    window.addEventListener('mousemove', this.onMoveWindow);
    window.skyrimPlatform.widgets.removeListener(this.handleWidgetUpdate.bind(this));
  }

  onWindowFocus(e) {
    const focus = document.hasFocus();
    this.props.updateBrowserFocus(focus);
  }

  onMoveWindow(e) {
    if (window.isMoveWindow && typeof window.moveWindow === 'function') {
      window.moveWindow(e.clientX, e.clientY);
    }
  }

  onMouseUp() {
    if (window.isMoveWindow) window.isMoveWindow = false;
    window.moveWindow = null;
  }

  render() {
    if (this.state.isLoggined) {
      return (
        <div className={`App ${!window.hasOwnProperty('skyrimPlatform') ? 'bg' : ''}`}>
          {this.state.isDevUiMode && (
            <div
              style={{
                position: 'fixed',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1200,
                background: 'rgba(14, 32, 40, 0.94)',
                border: '1px solid rgba(84, 200, 152, 0.55)',
                color: '#d8fff0',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontFamily: 'Segoe UI, Tahoma, sans-serif',
                letterSpacing: '0.03em'
              }}
            >
              Dev Mode | ?devOverlay=serverList | ?devOverlay=admin | ?devOverlay=serverList,admin
            </div>
          )}
          {!this.state.isDevUiMode && <AnimList />}
          {!this.state.isDevUiMode && <Chat />}
          {!this.state.isDevUiMode && <SkillsMenu />}
          {!this.state.isDevUiMode && <TestMenu />}
          <AdminDashboard />
          <ServerList />
        </div>
      );
    } else if (this.state.widgets) {
      return (
        <div style={{ position: 'static' }}>
          {this.state.widgets.map((widget, index) =>
            <Constructor
              key={index.toString() + widget.type + ((widget.type === 'form') ? widget.elements + widget.caption : 'chat')}
              dynamicSize={true}
              elem={widget}
              height={this.props.height || 704}
              width={this.props.width || 512} />
          )}
        </div>
      );
    } else { return <></>; }
  }
}

const mapStateToProps = (state) => {
  return {
    isBrowserFocus: state.appReducer.isBrowserFocus
  };
};

const mapDispatchToProps = (dispatch) => ({
  updateBrowserFocus: (data) =>
    dispatch({
      type: 'UPDATE_APP_BROWSERFOCUS',
      data
    })
});

export default connect(mapStateToProps, mapDispatchToProps)(App);
