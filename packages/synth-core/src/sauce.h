#ifndef BLOCKS_SAUCE_H
#define BLOCKS_SAUCE_H
#include "fullness.h"
#include <cmath>
namespace blocks_detail {
// Generic mono audio rack: no oscillator, note, UI or host dependencies.
// Use independent instances for stereo channels in a future external FX host.
struct SauceRack {
 FullnessPath before,after;
 static double drive(double input,double amount,double enabled){if(enabled==0)return input;const double wet=std::tanh(input*amount);return enabled==1?wet:input+enabled*(wet-input);}
 static double bodyStage(double input,FullnessPath&path,double amount,double dcPole,double alpha){
  const double residual=path.process(input,dcPole),colour=amount>0?input+amount*residual:input;
  const double body=path.body(colour,alpha);return amount>0?colour+amount*body:colour;
 }
 double process(double input,double driveAmount,double fullness,double order,double driveEnabled,double fullnessEnabled,double dcPole,double alpha){
  const double amount=fullness*fullnessEnabled;
  const double beforeFull=bodyStage(input,before,amount,dcPole,alpha);
  const double driven=drive(input,driveAmount,driveEnabled);
  const double afterFull=bodyStage(driven,after,amount,dcPole,alpha);
  if(order==0)return afterFull;
  const double beforeDrive=drive(beforeFull,driveAmount,driveEnabled);
  return order==1?beforeDrive:afterFull+order*(beforeDrive-afterFull);
 }
};
}
#endif
