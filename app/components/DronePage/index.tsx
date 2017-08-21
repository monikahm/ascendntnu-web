import * as React from 'react'

import { Section, SubSection } from '../PageLayout'
import { Breadcrumb } from '../Common/breadcrumb'
import { ModelRenderer } from '../Common/model'

export interface DronePageProps {}
export interface DronePageState {
  droneImages: any
}

export class DronePage extends React.Component<DronePageProps, DronePageState> {
  drones: any[]
  constructor () {
    super()

    this.drones = [
      {
        name: 'Drone 1',
        style: {
          backgroundImage: 'url(/images/drones/drone1-flying-minimized.jpg)'
        },
        content: [
          <span>Our first aerial robot was born fall of 2015. Creating it, flying it and using it has been a great learning experience for the team. The drone is however quite small, and we needed an upgrade in order to carry all the desired equipment.</span>,
        ]
      },
      {
        name: 'Drone 2',
        models: ['/images/drones/drone2.stl', '/images/drones/propell.stl'],
        style: {
          backgroundImage: 'url(/images/drones/drone2-minimized.jpg)'
        },
        content: [
          <span>Our second aerial robot is custom designed using carbon fiber and 3D-printed parts. It was build for the 2016 IARC and designed with Mission 7 in mind, and it is able to carry all the equipment we need to herd the target robots across the green line.</span>,
          <span>The <b>sensors</b> it has for navigation, ground robot detection and collision avoidance is five cameras, one laser rangefinder, one 2D laser scanner, and an inertial measurement unit.</span>,
          <span>The <b>data processing</b> is done using an on-board Intel NUC, in addition to an external computer communicating using WiFi. The flight controller is a Pixhawk connected to the NUC.</span>,
          <span>Our <b>software</b> can recognize the lines and corners of the grid, detect target robots and decide when and how to interact with them.</span>,
        ]
      },
      {
        name: 'Drone 3',
        style: {
          backgroundImage: 'url(/images/drones/drone3-minimized.jpg)'
        },
        content: [
          <span>Our third quadcopter was designed as a physically robust platform for testing new control software. The small size and low weight means that we can test new control strategies, including landing on ground robots, with less risk of damage to equipment.</span>,
          <span>It has a Pixhawk flight controller, an Odroid XU4 onboard computer running Ubuntu Server with ROS, and is used with an Optitrack tracking system. The custom made frame made of carbon fiber and 3D-printed parts allows compact placement of the hardware and even weight distribution, and well balanced motors from T-Motor minimize vibrations and yields high efficiency.</span>,
        ]
      }
    ]

    this.state = {
      droneImages: [
        (<div className="drone-image" style={this.drones[0].style}></div>),
        (<div className="drone-image" style={this.drones[1].style}></div>),
        //(<div className="drone-model"><ModelRenderer models={this.drones[1].models} process={[-80, 160, 160]} /></div>),
        (<div className="drone-image" style={this.drones[2].style}></div>),
      ]
    }
  }

  render () {
    let drones: any = this.drones.map((drone: any, i: number) => {
      let content: any = drone.content.map((e: any, n: number) => {
        return <p className="drone-text" key={n}>{e}</p>
      })

      return (
        <SubSection key={i} titleText={drone.name} className="drone-container">
          {this.state.droneImages[i] || null}
          {content}
        </SubSection>
      )
    })

    return (
      <div className="page page-drone">
        <Breadcrumb routes={['drone']} />
        <Section className="row">
          {drones}
        </Section>
      </div>
    )
  }
}

export default DronePage
