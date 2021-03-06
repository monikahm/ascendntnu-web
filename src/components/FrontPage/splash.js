import React, { Component } from 'react'

import { ModelRenderer } from '../Common/model'

export class Splash extends Component {
  constructor(props) {
    super(props)
    this.dirty = false
    this.width = window.innerWidth
    this.height = 640
    this.distance = this.width < 560 ? this.height : this.width
    this.svgAnimate = !navigator.userAgent.match(/Trident|Firefox/)
    this.state = {
      pos: this.width / 2,
      down: false,
      startPos: {
        x: 0,
        y: 0,
      },
      smallScreen: this.width < 560,
    }

    this.fitSplashToContainerHandler = this.fitSplashToContainerHandler.bind(
      this
    )
    this.mouseMoveHandler = this.mouseMoveHandler.bind(this)
    this.mouseUpHandler = this.mouseUpHandler.bind(this)
  }

  componentDidMount() {
    window.addEventListener('resize', this.fitSplashToContainerHandler)
    window.addEventListener('mousemove', this.mouseMoveHandler)
    window.addEventListener('mouseup', this.mouseUpHandler)

    let passive = { passive: true }
    window.addEventListener('touchmove', this.mouseMoveHandler, passive)
    window.addEventListener('touchend', this.mouseUpHandler, passive)
    window.addEventListener('touchcancel', this.mouseUpHandler, passive)

    this.height = document.querySelector('.front-splash').clientHeight
    this.distance = this.width < 560 ? this.height : this.width
    if (this.width < 560) {
      this.setState(
        Object.assign({}, this.state, {
          pos: document.querySelector('.front-splash p').clientHeight,
        })
      )
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.fitSplashToContainerHandler)
    window.removeEventListener('mousemove', this.mouseMoveHandler)
    window.removeEventListener('mouseup', this.mouseUpHandler)
    window.removeEventListener('touchmove', this.mouseMoveHandler)
    window.removeEventListener('touchend', this.mouseUpHandler)
    window.removeEventListener('touchcancel', this.mouseUpHandler)
  }

  fitSplashToContainerHandler(evt) {
    let splash = document.querySelector('.front-splash')
    this.width = window.innerWidth
    this.height = splash.clientHeight
    this.process = this.state.pos / this.distance
    this.distance = this.width < 560 ? this.height : this.width
    if (!this.dirty && this.width < 560) {
      this.setState(
        Object.assign({}, this.state, {
          smallScreen: true,
          pos: splash.querySelector('p').clientHeight,
        })
      )
    } else {
      if (!this.dirty) {
        this.setState(
          Object.assign({}, this.state, {
            smallScreen: this.width < 560,
            pos: this.width / 2,
          })
        )
      } else {
        if (this.state.smallScreen !== (this.width < 560)) {
          this.setState(
            Object.assign({}, this.state, {
              smallScreen: this.width < 560,
              pos: Math.max(
                Math.min(
                  this.process * this.distance,
                  this.distance * (this.state.smallScreen ? 0.85 : 0.9)
                ),
                this.distance * 0.1
              ),
            })
          )
        }
      }
    }
  }

  mouseMoveHandler(evt) {
    if (this.state.down) {
      let pos = {
        x: 0,
        y: 0,
      }

      if (evt.type === 'mousemove') {
        pos = {
          x: evt.clientX,
          y: evt.clientY,
        }
      } else {
        pos = {
          x: evt.touches[0].clientX,
          y: evt.touches[0].clientY,
        }
      }

      this.setState(
        Object.assign({}, this.state, {
          pos: Math.max(
            Math.min(
              this.state.smallScreen
                ? this.distance - pos.y + this.state.startPos.y
                : pos.x - this.state.startPos.x,
              this.distance * (this.state.smallScreen ? 0.85 : 0.9)
            ),
            this.distance * 0.1
          ),
        })
      )
    }
  }

  mouseDownHandler(evt) {
    let pos = {
      x: 0,
      y: 0,
    }

    if (evt.type === 'mousedown') {
      pos = {
        x: evt.clientX - this.state.pos,
        y: evt.clientY - (this.height - this.state.pos),
      }
    } else {
      evt.preventDefault()
      pos = {
        x: evt.touches[0].clientX - this.state.pos,
        y: evt.touches[0].clientY - (this.height - this.state.pos),
      }
    }

    this.dirty = true

    this.setState(
      Object.assign({}, this.state, {
        down: true,
        startPos: pos,
      })
    )
  }

  mouseUpHandler(evt) {
    if (this.state.down) {
      this.setState(
        Object.assign({}, this.state, {
          down: false,
        })
      )
    }
  }

  render() {
    let centerPos = this.distance / 2
    let process = this.state.pos / this.distance
    if (this.state.smallScreen) process = 1 - process

    let growLeft = centerPos / (1 - process) - centerPos
    let growRight = centerPos
    if (process > 0.5) {
      growLeft = centerPos
      growRight = centerPos / process - centerPos
    }

    let styles = {
      leftStyle: {
        flexGrow: this.state.smallScreen ? growRight : growLeft,
      },
      centerStyle: {
        position: this.state.smallScreen ? 'static' : 'absolute',
        left: this.state.smallScreen
          ? '50%'
          : Math.min(this.width, 100 * this.state.pos / this.width) + '%',
      },
      rightStyle: {
        flexGrow: this.state.smallScreen ? growLeft : growRight,
      },
    }

    return (
      <div className="front-splash">
        <ModelRenderer
          models={['/images/drones/drone2.stl']}
          process={Date.now()}
          autospin={true}
          wireframe={true}
          style={{ position: 'absolute' }}
        />
        <div className="front-splash-left" style={styles.leftStyle}>
          <p>
            Autonomus aerial robotics for fun and learning. Ascend NTNU is the{' '}
            <a href="http://www.ntnu.edu/">
              Norwegian University Of Science and Technology's
            </a>{' '}
            team in the{' '}
            <a href="http://www.aerialroboticscompetition.org/">
              International Aerial Robotics Competition
            </a>.
          </p>
        </div>
        <div
          className="front-splash-center"
          style={styles.centerStyle}
          onMouseDown={this.mouseDownHandler.bind(this)}
          onTouchStart={this.mouseDownHandler.bind(this)}
        >
          <img
            src={`/images/logo/logo-ascend-below-shadow${
              this.svgAnimate ? '-animation' : ''
            }.svg`}
            draggable={false}
            alt="Logo"
          />
        </div>
        <div className="front-splash-right" style={styles.rightStyle}>
          <ModelRenderer
            models={['/images/drones/drone2.stl']}
            process={Date.now()}
            autospin={true}
            style={{ position: 'absolute' }}
          />
        </div>
      </div>
    )
  }
}

export default Splash
