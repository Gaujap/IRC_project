import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './Chat.css';

const socket = io('https://irc-wzmf.onrender.com');

const Chat: React.FC = () => {
    const [messages, setMessages] = useState<{ text: string; pseudo: string}[]>([]);
    const [pseudo, setPseudo] = useState<string>('');
    const [isPseudoSet, setIsPseudoSet] = useState<boolean>(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedPseudo = localStorage.getItem('pseudo');
        if (savedPseudo) {
            setPseudo(savedPseudo);
            setIsPseudoSet(true);
            socket.emit('setPseudo', savedPseudo);
        }
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        socket.on('usersListResponse', (userList) => {
            const tempMessage = { text: `Connected users: ${userList.join(', ')}`, pseudo: 'System' };
            setMessages((prevMessages) => [...prevMessages, tempMessage]);

            setTimeout(() => {
                setMessages((prevMessages) => prevMessages.filter(msg => msg !== tempMessage));
            }, 5000);
        });

        return () => {
            socket.off('usersListResponse');
        };
    }, []);

    return (
    );
};

export default Chat;