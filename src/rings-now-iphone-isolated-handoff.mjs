// ISOLATED REVIEW-ONLY composition, no published HTML imports this.
// DO NOT treat this module as permission to accept real FIT in public pages.
import {createRingsNowIphoneSessionBoundary} from './rings-now-iphone-session-boundary.mjs';
import {createRingsNowPrivateFitController} from './rings-now-private-fit-ui-controller.mjs';

// The caller owns auth / selected run and MUST explicitly invalidate on every
// account, calendar selection, deletion or route change. No automatic FIT linking.
export function createRingsNowIphoneIsolatedHandoff({
  elements,document,readContext,nowMs,pageEvents,visibilityEvents,
  featureStartedAtMs=null,inspect,
}={}){
  const boundary=createRingsNowIphoneSessionBoundary({
    readContext,nowMs,pageEvents,visibilityEvents,featureStartedAtMs
  });
  let controller,active=true;
  try{
    controller=createRingsNowPrivateFitController({
      elements,document,isContextCurrent:boundary.isContextCurrent,inspect
    });
  }catch(error){
    boundary.destroy();
    throw error;
  }
  const invalidate=()=>{
    if(!active)return;
    boundary.invalidate();
    controller.invalidate();
  };
  const onPageHide=()=>invalidate();
  const onPageShow=event=>{if(event?.persisted)invalidate()};
  const onVisibility=()=>{if(visibilityEvents.hidden===true)invalidate()};
  pageEvents.addEventListener('pagehide',onPageHide);
  pageEvents.addEventListener('pageshow',onPageShow);
  visibilityEvents.addEventListener('visibilitychange',onVisibility);
  return {
    isContextCurrent:boundary.isContextCurrent,
    invalidate,
    destroy(){
      if(!active)return;
      active=false;
      boundary.destroy();
      controller.destroy();
      pageEvents.removeEventListener('pagehide',onPageHide);
      pageEvents.removeEventListener('pageshow',onPageShow);
      visibilityEvents.removeEventListener('visibilitychange',onVisibility);
    }
  };
}
