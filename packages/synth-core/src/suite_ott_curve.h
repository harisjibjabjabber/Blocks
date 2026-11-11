#ifndef BLOCKS_SUITE_OTT_CURVE_H
#define BLOCKS_SUITE_OTT_CURVE_H
#include <algorithm>
#include <cmath>
// Gain-law adaptation of David Braun's explicitly MIT-licensed xfer_ott function:
// https://github.com/grame-cncm/faustlibraries/blob/b8f0e061808aa320b899e82f81043164ace1d00f/compressors.lib
// Fitted knees, makeup/depth curves, and timing constants are retained.
// Blocks uses a different complementary crossover, exact silence, a low-level
// upward-gain guard, dB threshold controls, and separately smoothed band trims.
// This is not an exact replica of Xfer OTT or an endorsed implementation.
//
// Copyright (c) David Braun
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
namespace blocks_detail { namespace suite_detail {
struct OttCurve {
 inline static constexpr double upper[3]={-38.9401,-34.8204,-41.6879};
 inline static constexpr double attack[3]={.00621537,.006,.0096577};
 static double hinge(double width,double x){return std::max(x,0.)+(std::abs(x)>width*30?0:width*std::log1p(std::exp(-std::abs(x)/width)));}
 static double release(unsigned band,double time){
  constexpr double start[]={.0100376,.0118089,.00702632},middle[]={.0148167,.0174314,.00702632},end[]={.030877,.030877,.0103717};
  double t=std::min(1.,time),r=t<.5?start[band]+2*t*(middle[band]-start[band]):middle[band]+2*(t-.5)*(end[band]-middle[band]);return r*std::max(1.,time);
 }
 static double gainDb(unsigned band,double level,double depth,double up,double down,double threshold){
  if(depth==0)return 0;
  constexpr double lower[]={-46.0171,-46.5885,-47.4393},widthUp[]={.0552,.4509,.0338},slopeUp[]={.74786,.75601,.74738},widthDown[]={.5,.530023,.5};
  constexpr double makeup[]={14.0348,9.05203,14.064},cap[]={35.901,36.285,35.872},floor[]={-26.26,-31.70,-25.95};
  constexpr double ma[]={1.83819,1.63851,1.84440},mb[]={-1.21424,-.83224,-1.22723},mc[]={.37606,.19373,.38284};
  constexpr double da[]={.96509,.96161,.97286},db[]={.03154,.02205,.05778},dc[]={.00337,.01634,-.03064};
  double shift=threshold-upper[band],mk=depth*(ma[band]+depth*(mb[band]+depth*mc[band]));
  double ds=std::min(1.,depth*(da[band]+depth*(db[band]+depth*dc[band]))*down);
  double guard=std::max(0.,std::min(1.,(level+100)/35));
  double lift=std::min(cap[band],depth*up*slopeUp[band]*hinge(widthUp[band],lower[band]+shift-level))*guard;
  return std::max(floor[band],mk*makeup[band]+lift-ds*hinge(widthDown[band],level-threshold));
 }
};
}}
#endif
