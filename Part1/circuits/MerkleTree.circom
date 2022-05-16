pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template CheckRoot(n) { // compute the root of a MerkleTree of n Levels 
    signal input leaves[2**n];
    signal output root;

    //[assignment] insert your code here to calculate the Merkle root from 2^n leaves
    
    // a tree with n levels has 2^n leaves -> 1 hash per leaf
    component hash_tree[2**n];

    // for each level (we start from the bottom)
    for (var level = n; level > 0; level--) {
        // number of leaves at each level
        // (1st: 4, 2nd: 2, 3rd: 1)
        var leaves_at_level = 2 ** (level - 1); 

        // for each leaf
        for (var i = 0; i < leaves_at_level; i++) {
            // on each level we give indexes from 2^(level-1) to 2^(level-1) + (2 * 2^(level-1) - 1) to leaves
            // so we have unique indexes to save in our hash tree
            var index = leaves_at_level + i;
            hash_tree[index] = Poseidon(2);
            
            // if at the bottom level: H(leaves[i*2], leaves[i*2+1])
            if (level == n) {
                // 2k even
                hash_tree[index].inputs[0] <== leaves[i * 2];

                // 2k+1 odd
                hash_tree[index].inputs[1] <== leaves[i * 2 + 1];

            } 

            // if not at the bottom layer: H(H(previous_layer_left_branch), H(previous_layer_right_branch))
            else {
                // 2k even
                hash_tree[index].inputs[0] <== hash_tree[index * 2].out;

                // 2k + 1 odd
                hash_tree[index].inputs[1] <== hash_tree[index * 2 + 1].out;
            }
        }
    }

    root <== hash_tree[1].out;
}

template MerkleTreeInclusionProof(n) {
    signal input leaf;
    signal input path_elements[n];
    signal input path_index[n]; // path index are 0's and 1's indicating whether the current element is on the left or right
    signal output root; // note that this is an OUTPUT signal

    //[assignment] insert your code here to compute the root from a leaf and elements along the path
    
    // given an already hashed leaf and all the elements along its path to the root, compute the corresponding root

    component hashes[n];

    for (var i = 0; i < n; i++) {
        hashes[i] = Poseidon(2);

        var curr;
        if (i == 0) {
            curr = leaf;
        } else {
            curr = hashes[i-1].out;
        }

        var left = curr + (path_elements[i] - curr) * path_index[i];
        var right = path_elements[i] + (curr - path_elements[i]) * path_index[i];

        // H(left + right)
        hashes[i].inputs[0] <== left;
        hashes[i].inputs[1] <== right;
    }

    root <== hashes[n-1].out;
}
