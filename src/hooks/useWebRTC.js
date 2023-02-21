import React from 'react';
import freeice from 'freeice';
import socket from '../socket';
import ACTIONS from '../socket/actions';
import useStateWithCallback from './useStateWithCallback';

export const LOCAL_VIDEO = 'LOCAL_VIDEO';

export function useWebRTC(roomID) {

	const [clients, updateClients] = useStateWithCallback([]);

	const addNewClient = React.useCallback((newClient, cb) => {
		if (!clients.includes(newClient)) {
			updateClients(list => [...list, newClient], cb);
		}
	}, [clients, updateClients]);

	const peerConnections = React.useRef({});
	const localMediaStream = React.useRef(null);
	const peerMediaElements = React.useRef({
		[LOCAL_VIDEO]: null,
	});


	React.useEffect(() => {
		async function handleNewPeer({ peerID, createOffer }) {

			console.log('HANDLE NEW PEER: ', peerID, createOffer);

			if (peerID in peerConnections.current) {
				return console.warn(`Already connected to peer ${peerID}`)
			}

			console.log(`BEFORE PEER CONNECTION CURRENT ${peerID}: `, peerConnections.current[peerID]);

			peerConnections.current[peerID] = new RTCPeerConnection({
				iceServers: freeice(),
			});

			console.log(`AFTER PEER CONNECTION CURRENT ${peerID}: `, peerConnections.current[peerID]);

			peerConnections.current[peerID].onicecandidate = event => {

				if (event.candidate) {

					console.log('ACTIONS.RELAY_ICE: ', {candidate: event.candidate});

					socket.emit(ACTIONS.RELAY_ICE, {
						peerID,
						iceCandidate: event.candidate,
					});
				}
			}

			let tracksNumber = 0;
			peerConnections.current[peerID].ontrack = ({ streams: [remoteStream] }) => {

 				tracksNumber ++;

				console.log('ONTRACK: ', { peerID, remoteStream });

				 if (tracksNumber === 2) {
					addNewClient(peerID, () => {
						peerMediaElements.current[peerID].srcObject = remoteStream;
					});
				}
			}

			localMediaStream.current?.getTracks().forEach(track => {

				console.log('GET TRACKS: ', { peerID,  track });

				peerConnections.current[peerID].addTrack(track, localMediaStream.current)
			});

			if (createOffer) {

				const offer = await peerConnections.current[peerID].createOffer();

				console.log('CREATE OFFER: ', { peerID, offer });

				await peerConnections.current[peerID].setLocalDescription(offer);

				socket.emit(ACTIONS.RELAY_SDP, {
					peerID,
					sessionDescription: offer,
				})

			}


		}

		socket.on(ACTIONS.ADD_PEER, handleNewPeer);
	}, []);


	React.useEffect(() => {
		async function setRemoteMedia({peerID, sessionDescription: remoteDescription}) {
		  await peerConnections.current[peerID]?.setRemoteDescription(
			new RTCSessionDescription(remoteDescription)
		  );

		  console.log('ANSWER (SESSION DESCRIPTION): ', { peerID, remoteDescription });
	
		  if (remoteDescription.type === 'offer') {
			const answer = await peerConnections.current[peerID].createAnswer();
	
			await peerConnections.current[peerID].setLocalDescription(answer);
	
			socket.emit(ACTIONS.RELAY_SDP, {
			  peerID,
			  sessionDescription: answer,
			});
		  }
		}
	
		socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia)
	
		return () => {
		  socket.off(ACTIONS.SESSION_DESCRIPTION);
		}
	  }, []);

	  React.useEffect(() => {
		socket.on(ACTIONS.ICE_CANDIDATE, ({peerID, iceCandidate}) => {

			console.log('ACTIONS.ICE_CANDIDATE: ', { peerID, iceCandidate  });

			peerConnections.current[peerID]?.addIceCandidate(
				new RTCIceCandidate(iceCandidate)
			);
		});
	
		return () => {
		  socket.off(ACTIONS.ICE_CANDIDATE);
		}
	  }, []);

	  React.useEffect(() => {
		const handleRemovePeer = ({peerID}) => {
		  if (peerConnections.current[peerID]) {
			peerConnections.current[peerID].close();
		  }
	
		  delete peerConnections.current[peerID];
		  delete peerMediaElements.current[peerID];
	
		  updateClients(list => list.filter(c => c !== peerID));
		};
	
		socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer);
	
		return () => {
		  socket.off(ACTIONS.REMOVE_PEER);
		}
	  }, []);

	React.useEffect(() => {

		async function startCapture() {
			localMediaStream.current = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: {
					width: 1280,
					height: 720,
				}
			});

			addNewClient(LOCAL_VIDEO, (clients) => {

				console.log('ADD NEW CLIENT: ', clients);

				console.log(peerMediaElements.current);

				const localVideoElement = peerMediaElements.current[LOCAL_VIDEO];

				if (localVideoElement) {
					localVideoElement.volume = 0;
					localVideoElement.srcObject = localMediaStream.current;
				}

			})
		}

		startCapture()
		.then(() => socket.emit(ACTIONS.JOIN, { room: roomID }))
		.catch((e) => console.error('Error getting userMedia: ', e));


		return () => {
			localMediaStream.current?.getTracks().forEach(track => track.stop()); 
			socket.emit(ACTIONS.LEAVE);
		}

	}, [roomID]);

	const provideMediaRef = React.useCallback((id, node) => {

		console.log('PROVIDE MEDIA REF: ', id, node);

		peerMediaElements.current[id] = node;
	}, []);

	return {
		clients,
		provideMediaRef
	}



}