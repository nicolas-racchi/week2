//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {PoseidonT3} from "./Poseidon.sol"; //an existing library to perform Poseidon hash on solidity
import "./verifier.sol"; //inherits with the MerkleTreeInclusionProof verifier contract

contract MerkleTree is Verifier {
    uint256[] public hashes; // the Merkle tree in flattened array form
    uint256 public index = 0; // the current index of the first unfilled leaf
    uint256 public root; // the current Merkle root

    constructor() {
        // [assignment] initialize a Merkle tree of 8 with blank leaves
        // 2^4 -1 = 15
        hashes = new uint256[](15);
    }

    function insertLeaf(uint256 hashedLeaf) public returns (uint256 result) {
        // [assignment] insert a hashed leaf into the Merkle tree

        // a function to insertt a new already hashed leaf and update the relevant elements in the tree

        uint256 temp = index;
        uint256 count = 0;

        // insert leaf
        hashes[index + 1] = hashedLeaf;

        // starting from the bottom, we have to recalculate the correct part of the hash tree above the new leaf
        for (uint256 level = 3; level > 0; level--) {
            uint256 i = temp + count;

            // change the left or right branch
            if (i % 2 == 0) {
                result = PoseidonT3.poseidon([hashes[i], hashes[i + 1]]);
            } else {
                result = PoseidonT3.poseidon([hashes[i - 1], hashes[i]]);
            }

            // update the index to be at the first leaf of the next level
            count = count + 2**level;
            temp = temp / 2;

            hashes[count + temp] = result;
        }
    }

    function verify(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory input
    ) public view returns (bool) {
        // [assignment] verify an inclusion proof and check that the proof root matches current root
        return verifyProof(a, b, c, input);
    }
}
