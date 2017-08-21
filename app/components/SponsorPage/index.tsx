import * as React from 'react'
import { browserHistory } from 'react-router'

import { Section, SubSection } from '../PageLayout'
import { Breadcrumb } from '../Common/breadcrumb'
import { SponsorList } from '../Common/sponsorlist'

export interface SponsorPageProps {
  params?: any & {
    year?: number
  }
}

export interface SponsorPageState {
  year: number,
}

export class SponsorPage extends React.Component<SponsorPageProps, SponsorPageState> {
  constructor (props: any) {
    super(props)

    this.state = {
      year: props.params.year || 2017,
    }
  }

  private changeYear (evt: any) {
    let year: number = evt.target.value
    browserHistory.push('/sponsors/' + year)
    this.setState({
      year: year,
    })
  }

  componentWillReceiveProps (nextProps: any) {
    let nextYear: number = parseInt(nextProps.params.year) || 2017
    let year: number = parseInt(this.props.params.year) || this.state.year

    if (nextYear != year) {
      year = nextYear

      this.setState({
        year: year,
      })
    }
  }

  render () {
    let title: any = (
      <span>Our sponsors <select className="select-sponsor select" onChange={this.changeYear.bind(this)} defaultValue={this.state.year + ''}>
        <option value="2016">2016</option>
        <option value="2017">2017</option>
      </select>
      </span>
    )

    return (
      <div className="page page-sponsors">
        <Breadcrumb routes={['sponsors']} />
        <Section titleText={title} className="centered">
          <SponsorList year={this.state.year} />
        </Section>
      </div>
    )
  }
}

export default SponsorPage
