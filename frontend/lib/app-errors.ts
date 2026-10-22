import {toast} from 'react-toastify';

const EMAIL_ALREADY_EXISTS='A user with this email address already exists. Use a different email address.';
const messages:Record<string,string>={SERVER_ERROR:'Something went wrong on the server. Please try again.',DATABASE_UNAVAILABLE:'The service is temporarily unavailable. Please try again shortly.',INVALID_DATE_RANGE:'Choose a valid date range with the end date after the start date.',INVALID_DURATION:'Enter a valid recording duration.',UNAUTHORIZED:'Your session has expired. Please sign in again.',WRONG_PASSWORD:'Your current password is not correct.',FORBIDDEN:'You do not have permission to perform this action.',NOT_FOUND:'The requested item is no longer available.',RECORDING_FILE_EXPIRED:'This recording has expired or is no longer available.',REPLAY_STORAGE_UNAVAILABLE:'Recording storage is temporarily unavailable. Please retry shortly.'};
export function friendlyError(error:unknown,status?:number):string{
 const text=typeof error==='string'?error:error instanceof Error?error.message:'';
 if(text==='EMAIL_ALREADY_EXISTS')return EMAIL_ALREADY_EXISTS;
 if(messages[text])return messages[text];
 if(error instanceof Error&&error.name==='TimeoutError')return 'The request took too long. Please try again.';
 if(/failed to fetch|networkerror|load failed|network request failed/i.test(text))return 'Unable to connect. Check your connection and try again.';
 if(status===401)return messages.UNAUTHORIZED;if(status===403)return messages.FORBIDDEN;
 if(status===429)return 'Too many requests. Please wait a moment and try again.';
 if(status&&status>=500)return messages.SERVER_ERROR;
 if(!text||/^[A-Z][A-Z_\d]+$/.test(text)||/prisma|sql|stack trace|unexpected token|internal server/i.test(text))return 'Something went wrong. Please try again.';
 return text.slice(0,240);
}
const recent=new Map<string,number>();
export function notifyError(error:unknown,status?:number){
 if(typeof window==='undefined'||error instanceof Error&&error.name==='AbortError')return;
 const message=friendlyError(error,status),now=Date.now();
 if(now-(recent.get(message)||0)<30000)return;
 recent.set(message,now);for(const [key,time]of recent)if(now-time>60000)recent.delete(key);
 toast.error(message,{toastId:`app-error:${message}`});
}
export function userFacingRequest(url:string){
 try{const path=new URL(url,window.location.origin).pathname;return path.includes('/api/')&&!/\/api\/(events|session-replays\/(start|chunk|end)|checkout\/abandoned|admin-session\/(login|verify|logout)|admin-proxy\/api\/auth\/me|account\/cart)(\/|$)/.test(path);}catch{return false;}
}
