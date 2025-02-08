import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './Chat.css';

const socket = io('https://irc-wzmf.onrender.com');

const Chat: React.FC = () => {
    const [messages, setMessages] = useState<{ text: string; pseudo: string}[]>([]);
    const [input, setInput] = useState<string>('');
    const [channels, setChannels] = useState<string[]>([]);
    const [currentChannel, setCurrentChannel] = useState<string>('general');
    const [pseudo, setPseudo] = useState<string>('');
    const [isPseudoSet, setIsPseudoSet] = useState<boolean>(false);
    const [userChannels, setUserChannels] = useState<string[]>(["general"]);
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

    useEffect(() => {
        socket.on('updateChannels', (fetchedChannels) => {
            setChannels(fetchedChannels);
        });

        socket.on('initial messages', (fetchedMessages) => {
            setMessages(fetchedMessages);
        });

        socket.on('chat message', (newMessage) => {
            if (newMessage.channel === currentChannel) {
                setMessages((prevMessages) => [...prevMessages, newMessage]);
            }
        });

        socket.on('pseudoSet', (newPseudo) => {
            setPseudo(newPseudo);
            setIsPseudoSet(true);
            localStorage.setItem('pseudo', newPseudo);
        });

        socket.on('updateUserChannels', (userChannelsList) => {
            setUserChannels(userChannelsList);
        });

        socket.on('error', (errorMessage) => {
            alert(errorMessage);
        });

        socket.emit('joinChannel', currentChannel);

        return () => {
            socket.off('updateChannels');
            socket.off('initial messages');
            socket.off('chat message');
            socket.off('pseudoSet');
            socket.off('updateUserChannels');
            socket.off('error');
        };
    }, [currentChannel]);

    const handlePseudoChange = (e: React.FormEvent) => {
        e.preventDefault();
        socket.emit('setPseudo', pseudo);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!isPseudoSet) {
            alert('Please set a pseudo before sending a message.');
            return;
        }

        const parts = input.split(' ');
        const command = parts[0];
        const param = parts.slice(1).join(' ');

        switch (command) {
            case '/nick':
                socket.emit('setPseudo', param);
                break;
            case '/list':
                socket.emit('listChannels');
                break;
            case '/create':
                socket.emit('createChannel', param);
                break;
            case '/delete':
                socket.emit('deleteChannel', param);
                break;
            case '/join':
                handleChannelChange(param);
                break;
            case '/quit':
                socket.emit('quitChannel', param);
                setUserChannels((prev) => prev.filter(c => c !== param));
                handleChannelChange('general');
                break;
            case '/users':
                socket.emit('listUsers');
                break;
            case '/add':
                socket.emit('addChannel', param);
                break;
            case '/msg':
                const [target, ...msgParts] = param.split(' ');
                const msgContent = msgParts.join(' ');
                const privateChannel = [pseudo, target].sort().join('_');

                socket.emit('createPrivateChannel', { privateChannel, target, message: msgContent });
                handleChannelChange(privateChannel);
                break;
            default:
                socket.emit('chat message', { channel: currentChannel, message: input });
        }

        setInput('');
    };

    const handleChannelChange = (channel: string) => {
        setCurrentChannel(channel);
        socket.emit('joinChannel', channel);
    };

    return (
    );
};

export default Chat;