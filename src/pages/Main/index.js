import React from 'react';
import { useNavigate } from 'react-router';

import socket from "../../socket";
import ACTIONS from '../../socket/actions';

import { v4 } from 'uuid';




export default function Main() {

	const navigate = useNavigate();
	const rootNode = React.useRef();
	const [ rooms, updateRooms ] = React.useState([]);

	React.useEffect(() => {
		socket.on(ACTIONS.SHARE_ROOMS, ({ rooms = [] }) => {

			if (rootNode.current) {
				updateRooms(rooms);
			}
			
		});
	}, []);

	return (
		<div ref={rootNode}>
			<h1> Available Rooms </h1>
	
			<ul>
				{rooms.map(roomID => (
					<li key={roomID}>
						{roomID}
						<button onClick={() => {
							navigate(`/room/${roomID}`);
						}}> JOIN ROOM </button>
					</li>
				))}
			</ul>

			<button onClick={() => {
				navigate(`/room/${v4()}`)
			}}> Create new room </button>
		</div>
	);
};