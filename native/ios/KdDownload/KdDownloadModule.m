#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(KdDownloadModule, RCTEventEmitter)

RCT_EXTERN_METHOD(startDownload:(NSString *)url
                  fileName:(NSString * _Nullable)fileName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(pauseDownload)
RCT_EXTERN_METHOD(resumeDownload)
RCT_EXTERN_METHOD(cancelDownload)

RCT_EXTERN_METHOD(getState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getDownloadDirectory:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
